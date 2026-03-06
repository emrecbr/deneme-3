import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import api, { API_BASE_URL } from '../api/axios';
import CategorySelector from '../components/CategorySelector';
import EmptyStateCard from '../components/EmptyStateCard';
import ErrorStateCard from '../components/ErrorStateCard';
import FilterBar from '../components/FilterBar';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import LocationPermissionModal from '../components/LocationPermissionModal';
import RFQSkeletonGrid from '../components/RFQSkeletonGrid';
import RFQCreate from './RFQCreate';
import { useAuth } from '../context/AuthContext';
import { useLiveLocation } from '../context/LocationContext';
import { getSocket, normalizeSocketCity } from '../lib/socket';
import { triggerHaptic } from '../utils/haptic';
import { formatRemainingTime, getRequestStatusLabel, isActiveRequest } from '../utils/rfqStatus';
import { getDistanceKm } from '../utils/distance';
import { FavoriteIcon } from '../components/ui/AppIcons';

const PAGE_LIMIT = 10;
const RFQ_CACHE_KEY = 'rfq_list_cache_v1';
const SEARCH_HISTORY_KEY = 'rfq_search_history_v1';

function MapZoomSync({ onZoomChange, onBoundsChange, onUserMove, suppressUpdates }) {
  useMapEvents({
    zoomend: (event) => {
      if (suppressUpdates) {
        return;
      }
      onZoomChange(event.target.getZoom());
      if (onBoundsChange) {
        const bounds = event.target.getBounds();
        onBoundsChange({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        });
      }
    },
    moveend: (event) => {
      if (suppressUpdates) {
        return;
      }
      if (onBoundsChange) {
        const bounds = event.target.getBounds();
        onBoundsChange({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        });
      }
      if (onUserMove) {
        onUserMove();
      }
    }
  });

  return null;
}

function calculateDistance(fromLat, fromLng, toLat, toLng) {
  const earthRadius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function RFQList() {
  const BACKEND_ORIGIN = API_BASE_URL.replace('/api', '');
  const { selectedCity, setSelectedCity, selectedDistrict, setSelectedDistrict } = useAuth();
  const navigate = useNavigate();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const observerRef = useRef(null);
  const clusterRef = useRef(null);
  const newMarkerTimeoutsRef = useRef({});
  const userPositionRef = useRef(null);
  const cityFallbackAttemptedRef = useRef({ key: '', failed: false });
  const loadMoreRef = useRef(null);
  const touchStartXRef = useRef({});
  const imageTouchStartXRef = useRef({});
  const pullStartYRef = useRef(null);
  const resultsToastTimerRef = useRef(null);
  const resultsToastHideTimerRef = useRef(null);
  const createSheetCloseTimerRef = useRef(null);
  const createSheetDragStartYRef = useRef(0);
  const createSheetDragStartTranslateRef = useRef(45);
  const searchInputRef = useRef(null);
  const mapRef = useRef(null);

  const [rfqs, setRfqs] = useState([]);
  const [nearbyRFQs, setNearbyRFQs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [error, setError] = useState('');
  const [swipedCard, setSwipedCard] = useState({ id: null, offset: 0 });
  const [imageIndexes, setImageIndexes] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [favoriteAnimating, setFavoriteAnimating] = useState({});
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(() => localStorage.getItem('rfq_sortKey') || 'date_desc');
  const [isCreateSheetMounted, setIsCreateSheetMounted] = useState(false);
  const [createSheetState, setCreateSheetState] = useState('closed');
  const [isCreateSheetDragging, setIsCreateSheetDragging] = useState(false);
  const [createSheetDragTranslate, setCreateSheetDragTranslate] = useState(35);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [inlineSubcategories, setInlineSubcategories] = useState([]);
  const [flatSubcategories, setFlatSubcategories] = useState([]);
  const [filterCompact, setFilterCompact] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [newRFQMarkers, setNewRFQMarkers] = useState({});
  const [mapZoom, setMapZoom] = useState(11);
  const [mapBounds, setMapBounds] = useState(null);
  const [mapHasMoved, setMapHasMoved] = useState(false);
  const [mapAreaFilterActive, setMapAreaFilterActive] = useState(false);
  const [mapAreaFilterIds, setMapAreaFilterIds] = useState(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [previewTranslate, setPreviewTranslate] = useState(0);
  const [previewDragging, setPreviewDragging] = useState(false);
  const previewStartYRef = useRef(0);
  const previewStartTranslateRef = useRef(0);
  const [previewSnap, setPreviewSnap] = useState('collapsed');
  const [previewHeights, setPreviewHeights] = useState(() => ({
    full: 0,
    mid: 0,
    collapsed: 0
  }));
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    } catch (_error) {
      return [];
    }
  });
  const [filters, setFilters] = useState({
    radius: 30,
    cityId: null,
    districtId: null,
    category: null,
    city: null,
    district: null,
    sort: 'date_desc',
    status: null
  });
  const [draftFilters, setDraftFilters] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationWarning, setLocationWarning] = useState('');
  const [locationSelection, setLocationSelection] = useState(null);
  const [showResultsToast, setShowResultsToast] = useState(false);
  const [resultsToastVisible, setResultsToastVisible] = useState(false);
  const [mapRadiusKm, setMapRadiusKm] = useState(() => Number(filters.radius) || 0);

  const currentUserId = useMemo(() => currentUser?.id || currentUser?._id || null, [currentUser]);
  const activeCity = useMemo(() => normalizeSocketCity(filters.city || currentUser?.city), [currentUser?.city, filters.city]);
  const isDarkMode = document.body.classList.contains('dark-mode');
  const showActiveOnly = Boolean(filters.status === 'active' || filters.activeOnly);
  const {
    liveLocation,
    status: liveStatus,
    errorMessage: liveError,
    accuracy,
    startLiveLocation,
    stopLiveLocation
  } = useLiveLocation();
  const shouldSuppressMapUpdates = Boolean(selectedRfq?._id);
  function getRFQCoords(rfq) {
    if (!rfq) {
      return null;
    }
    const locationCandidates = [rfq?.location, rfq?.buyer?.location, rfq?.address?.location];

    for (let index = 0; index < locationCandidates.length; index += 1) {
      const item = locationCandidates[index];
      if (!item) {
        continue;
      }

      if (Array.isArray(item?.coordinates) && item.coordinates.length >= 2) {
        const lat = Number(item.coordinates[1]);
        const lng = Number(item.coordinates[0]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
        continue;
      }

      if (Array.isArray(item) && item.length >= 2) {
        const lat = Number(item[1]);
        const lng = Number(item[0]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
        continue;
      }

      const lat = Number(item?.lat ?? item?.latitude);
      const lng = Number(item?.lng ?? item?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }
  const getCityName = useCallback((item) => {
    if (!item) {
      return '';
    }

    if (typeof item.city === 'string') {
      return item.city;
    }

    if (item.city && typeof item.city === 'object') {
      return item.city.name || '';
    }

    return item.locationData?.city || '';
  }, []);
  const getDistrictName = useCallback((item) => {
    if (!item) {
      return '';
    }

    if (typeof item.district === 'string') {
      return item.district;
    }

    if (item.district && typeof item.district === 'object') {
      return item.district.name || '';
    }

    return item.locationData?.district || '';
  }, []);
  const isPremiumRFQ = useCallback(
    (rfq) => Boolean(rfq?.isPremium || rfq?.premium || rfq?.plan === 'premium' || Number(rfq?.targetPrice) > 100000),
    []
  );
  const isFeaturedRFQ = useCallback((rfq) => {
    if (!rfq) {
      return false;
    }
    if (rfq.featuredActive != null) {
      return Boolean(rfq.featuredActive);
    }
    if (!rfq.isFeatured || !rfq.featuredUntil) {
      return false;
    }
    return new Date(rfq.featuredUntil).getTime() > Date.now();
  }, []);

  const mergeUniqueRFQs = useCallback((existing, incoming) => {
    const map = new Map(existing.map((item) => [item._id, item]));
    incoming.forEach((item) => map.set(item._id, item));
    return Array.from(map.values());
  }, []);

  const cacheRFQs = useCallback((payload) => {
    localStorage.setItem(RFQ_CACHE_KEY, JSON.stringify(payload));
  }, []);

  const readCachedRFQs = useCallback(() => {
    const raw = localStorage.getItem(RFQ_CACHE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }, []);

  const handleAuthFailure = useCallback(
    (status) => {
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return true;
      }
      return false;
    },
    [navigate]
  );

  const fetchRFQs = useCallback(
    async ({ nextPage = 1, replace = false, isRefresh = false } = {}) => {
      try {
        if (replace && !isRefresh) {
          setLoading(true);
        }

        if (nextPage > 1) {
          setLoadingMore(true);
        }

        if (isRefresh) {
          setRefreshing(true);
        }

        const response = await api.get('/rfq', {
          params: {
            page: nextPage,
            limit: PAGE_LIMIT,
            cityId: filters.cityId || undefined,
            districtId: filters.districtId || undefined
          }
        });
        const items = response.data?.items || [];
        setRfqs(items);
        cacheRFQs({ items, lastPage: nextPage, hasMore: response.data?.hasMore ?? false });
        const nextHasMore = response.data?.hasMore ?? items.length >= PAGE_LIMIT;
        setHasMore(Boolean(nextHasMore));
        setPage(nextPage);
        setError('');
      } catch (fetchError) {
        if (handleAuthFailure(fetchError.response?.status)) {
          return;
        }
        const cached = readCachedRFQs();

        if (cached?.items?.length) {
          setRfqs(cached.items);
          setPage(cached.lastPage || 1);
          setHasMore(Boolean(cached.hasMore));
          setError('Canli veri alinamadi. Son onbellek gosteriliyor.');
        } else {
          setError(fetchError.response?.data?.message || 'Talepler yuklenemedi.');
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [cacheRFQs, filters.cityId, filters.districtId, handleAuthFailure, readCachedRFQs]
  );

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const payload = response.data?.data || response.data || {};
      setCurrentUser(payload.user || payload || null);
    } catch (_error) {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      city: selectedCity?.name || null,
      cityId: selectedCity?._id || null,
      district: selectedDistrict?.name || null,
      districtId: selectedDistrict?._id || null
    }));
  }, [selectedCity, selectedDistrict]);

  useEffect(() => {
    if (!isFilterSheetOpen) {
      return;
    }
    setDraftFilters((prev) => ({
      ...(prev || filters),
      city: filters.city,
      cityId: filters.cityId,
      district: filters.district,
      districtId: filters.districtId
    }));
  }, [filters.city, filters.cityId, filters.district, filters.districtId, filters, isFilterSheetOpen]);

  const fetchFavorites = useCallback(async () => {
    try {
      const response = await api.get('/users/favorites');
      const nextFavoriteItems = response.data?.data || response.data?.items || [];
      setFavoriteItems(nextFavoriteItems);
      setFavorites(nextFavoriteItems.map((item) => String(item._id)));
    } catch (_error) {
      setFavoriteItems([]);
      setFavorites([]);
    }
  }, []);

  const fetchLocationSelection = useCallback(async () => {
    try {
      const response = await api.get('/users/location-selection');
      setLocationSelection(response.data?.items?.[0] || response.data?.data || null);
    } catch (_error) {
      setLocationSelection(null);
    }
  }, []);

  useEffect(() => {
    let lastPath = window.location.pathname;
    const watchPath = () => {
      const nextPath = window.location.pathname;
      if (nextPath !== lastPath) {
        lastPath = nextPath;
        setPathname(nextPath);
      }
    };

    const intervalId = window.setInterval(watchPath, 200);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isSearchSheetOpen) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
    return () => {
      document.body.classList.remove('sheet-open');
    };
  }, [isSearchSheetOpen]);

  useEffect(() => {
    if (isSearchSheetOpen) {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      });
    } else {
      searchInputRef.current?.blur();
    }
  }, [isSearchSheetOpen]);

  useEffect(() => {
    fetchRFQs({ nextPage: 1, replace: true });
    fetchCurrentUser();
  }, [fetchRFQs, fetchCurrentUser, pathname]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    fetchLocationSelection();
  }, [fetchLocationSelection]);

  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const fetchNearbyByCoords = useCallback(
    async (coords) => {
      if (!coords) {
        return;
      }

      const query = new URLSearchParams({
        lng: String(coords.lng),
        lat: String(coords.lat),
        radius: String(filters.radius)
      });
      if (filters.category) {
        query.set('category', String(filters.category));
      }
      if (filters.city) {
        query.set('city', String(filters.city));
      }

      try {
        const response = await api.get(`/rfq/nearby?${query.toString()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        setNearbyRFQs(response.data?.data || response.data?.items || []);
      } catch (fetchError) {
        if (handleAuthFailure(fetchError.response?.status)) {
          return;
        }
        throw fetchError;
      }
    },
    [filters.category, filters.city, filters.radius, handleAuthFailure]
  );

  const fetchCityFallback = useCallback(async () => {
    const fallbackCityId = String(filters.cityId || '').trim();
    const fallbackKey = `${fallbackCityId || ''}:${String(filters.districtId || '')}:${String(
      filters.city || ''
    )}`;
    if (cityFallbackAttemptedRef.current.key !== fallbackKey) {
      cityFallbackAttemptedRef.current = { key: fallbackKey, failed: false };
    }

    if (!fallbackCityId) {
      const selectedName = String(filters.city || '').toLowerCase();
      if (!selectedName) {
        setNearbyRFQs([]);
        return;
      }
      const cityOnly = rfqs.filter((item) => String(getCityName(item)).toLowerCase() === selectedName);
      setNearbyRFQs(cityOnly);
      return;
    }

    if (cityFallbackAttemptedRef.current.failed) {
      try {
        const response = await api.get('/rfq', {
          params: { page: 1, limit: 100 },
          headers: { 'Cache-Control': 'no-cache' }
        });
        setNearbyRFQs(response.data?.data || response.data?.items || []);
      } catch (_error) {
        setNearbyRFQs([]);
      }
      return;
    }

    try {
      const response = await api.get('/rfq', {
        params: {
          page: 1,
          limit: 100,
          cityId: fallbackCityId,
          districtId: filters.districtId || undefined
        },
        headers: { 'Cache-Control': 'no-cache' }
      });
      setNearbyRFQs(response.data?.data || response.data?.items || []);
    } catch (fallbackError) {
      console.log('CITY FALLBACK ERROR:', fallbackError);
      cityFallbackAttemptedRef.current = { key: fallbackKey, failed: true };
      setToast('Sehir filtreleme gecici olarak calismiyor, tum ilanlar gosteriliyor.');
      window.setTimeout(() => setToast(null), 2000);
      try {
        const response = await api.get('/rfq', {
          params: { page: 1, limit: 100 },
          headers: { 'Cache-Control': 'no-cache' }
        });
        setNearbyRFQs(response.data?.data || response.data?.items || []);
      } catch (_error) {
        const selectedName = String(filters.city || '').toLowerCase();
        const cityOnly = rfqs.filter((item) => String(getCityName(item)).toLowerCase() === selectedName);
        setNearbyRFQs(cityOnly);
      }
    }
  }, [filters.city, filters.cityId, filters.districtId, getCityName, rfqs, setToast]);

  const resolveLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setLocationWarning('Bu cihazda konum servisi desteklenmiyor.');
      setError('Konum alinmadi. Sehir bazli liste gosteriliyor.');
      setShowLocationModal(true);
      await fetchCityFallback();
      return false;
    }

    setLocationLoading(true);
    setLocationWarning('');
    startLiveLocation();
    return true;
  }, [fetchCityFallback, startLiveLocation]);

  useEffect(() => {
    if (liveStatus === 'active' && liveLocation) {
      setUserPosition(liveLocation);
      setUserCoords(liveLocation);
      setShowLocationModal(false);
      setLocationDenied(false);
      setLocationWarning('');
      setError('');
      setLocationLoading(false);
      fetchNearbyByCoords(liveLocation).catch(() => {});
      return;
    }

    if (liveStatus === 'denied') {
      setLocationDenied(true);
      setLocationWarning('Konum izni reddedildi.');
      setLocationLoading(false);
      setShowLocationModal(true);
      fetchCityFallback();
      return;
    }

    if (liveStatus === 'error') {
      setLocationDenied(true);
      setLocationWarning(liveError || 'Konum alinamadi.');
      setLocationLoading(false);
      setShowLocationModal(true);
      fetchCityFallback();
    }
  }, [fetchCityFallback, fetchNearbyByCoords, liveError, liveLocation, liveStatus]);

  useEffect(() => {
    if (liveLocation) {
      setUserPosition(liveLocation);
      setUserCoords(liveLocation);
    }
  }, [liveLocation]);

  useEffect(() => {
    if (userCoords) {
      return;
    }
    fetchCityFallback();
  }, [fetchCityFallback, userCoords]);

  useEffect(() => {
    const onScroll = () => {
      setFilterCompact(window.scrollY > 24);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (viewMode !== 'map') {
      setSelectedRfq(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'map') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [viewMode]);

  useEffect(() => {
    if (clusterRef.current?.refreshClusters) {
      clusterRef.current.refreshClusters();
    }
  }, [isDarkMode, mapZoom]);

  useEffect(() => {
    const compute = () => {
      const height = Math.min(window.innerHeight * 0.9, window.innerHeight - 40);
      const collapsedVisible = 110;
      const midVisible = window.innerHeight * 0.55;
      const fullTranslate = 0;
      const midTranslate = Math.max(0, height - midVisible);
      const collapsedTranslate = Math.max(0, height - collapsedVisible);
      setPreviewHeights({
        full: fullTranslate,
        mid: midTranslate,
        collapsed: collapsedTranslate
      });
      setPreviewTranslate((prev) => {
        if (previewSnap === 'full') return fullTranslate;
        if (previewSnap === 'mid') return midTranslate;
        return collapsedTranslate;
      });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [previewSnap]);

  useEffect(() => {
    if (!selectedRfq) {
      setPreviewSnap('collapsed');
      setPreviewTranslate(previewHeights.collapsed);
      return;
    }
    setPreviewSnap('mid');
    setPreviewTranslate(previewHeights.mid);
  }, [previewHeights, selectedRfq]);

  const startPreviewDrag = useCallback((event) => {
    const point = 'touches' in event ? event.touches[0] : event;
    previewStartYRef.current = point.clientY;
    previewStartTranslateRef.current = previewTranslate;
    setPreviewDragging(true);
  }, [previewTranslate]);

  const onPreviewDragMove = useCallback((event) => {
    if (!previewDragging) {
      return;
    }
    const point = 'touches' in event ? event.touches[0] : event;
    const delta = point.clientY - previewStartYRef.current;
    const next = Math.min(previewHeights.collapsed + 120, Math.max(0, previewStartTranslateRef.current + delta));
    setPreviewTranslate(next);
  }, [previewDragging, previewHeights.collapsed]);

  const endPreviewDrag = useCallback(() => {
    if (!previewDragging) {
      return;
    }
    setPreviewDragging(false);
    if (previewTranslate > previewHeights.collapsed + 80) {
      setSelectedRfq(null);
      setPreviewSnap('collapsed');
      setPreviewTranslate(previewHeights.collapsed);
      return;
    }
    const candidates = [
      { key: 'full', value: previewHeights.full },
      { key: 'mid', value: previewHeights.mid },
      { key: 'collapsed', value: previewHeights.collapsed }
    ];
    let nearest = candidates[0];
    let minDistance = Math.abs(previewTranslate - candidates[0].value);
    candidates.forEach((candidate) => {
      const dist = Math.abs(previewTranslate - candidate.value);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = candidate;
      }
    });
    setPreviewSnap(nearest.key);
    setPreviewTranslate(nearest.value);
  }, [previewDragging, previewHeights, previewTranslate]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode !== 'map') {
      setMapAreaFilterActive(false);
      setMapAreaFilterIds(null);
      setMapHasMoved(false);
    }
  }, [viewMode]);

  useEffect(() => {
    setMapAreaFilterActive(false);
    setMapAreaFilterIds(null);
  }, [filters.city, filters.cityId, filters.district, filters.districtId, filters.radius]);

  useEffect(() => {
    const socket = getSocket({
      userId: currentUserId,
      city: activeCity
    });
    if (activeCity) {
      socket.emit('join_city', activeCity);
    }

    const onNewRFQ = (rfq) => {
      if (!rfq?._id) {
        return;
      }
      const incomingCity = normalizeSocketCity(getCityName(rfq));
      if (activeCity && incomingCity && incomingCity !== activeCity) {
        return;
      }

      if (userPositionRef.current && Array.isArray(rfq?.location?.coordinates) && rfq.location.coordinates.length >= 2) {
        const rfqLng = Number(rfq.location.coordinates[0]);
        const rfqLat = Number(rfq.location.coordinates[1]);
        if (Number.isFinite(rfqLng) && Number.isFinite(rfqLat)) {
          const distance = calculateDistance(userPositionRef.current.lat, userPositionRef.current.lng, rfqLat, rfqLng);
          if (distance > 50) {
            return;
          }
        }
      }

      setRfqs((prev) => mergeUniqueRFQs(prev, [rfq]));
      setNearbyRFQs((prev) => mergeUniqueRFQs(prev, [rfq]));
      setNewRFQMarkers((prev) => ({ ...prev, [rfq._id]: true }));

      if (newMarkerTimeoutsRef.current[rfq._id]) {
        window.clearTimeout(newMarkerTimeoutsRef.current[rfq._id]);
      }

      newMarkerTimeoutsRef.current[rfq._id] = window.setTimeout(() => {
        setNewRFQMarkers((prev) => {
          const next = { ...prev };
          delete next[rfq._id];
          return next;
        });
        delete newMarkerTimeoutsRef.current[rfq._id];
      }, 3000);
    };

    socket.on('new_rfq', onNewRFQ);

    return () => {
      socket.off('new_rfq', onNewRFQ);
      if (activeCity) {
        socket.emit('leave_city', activeCity);
      }
      Object.values(newMarkerTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      newMarkerTimeoutsRef.current = {};
    };
  }, [activeCity, currentUserId, getCityName, mergeUniqueRFQs]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const fetchNearby = useCallback(async () => {
    if (!userCoords) {
      return;
    }

    setNearbyLoading(true);
    try {
      await fetchNearbyByCoords(userCoords);
    } catch (fetchError) {
      if (handleAuthFailure(fetchError.response?.status)) {
        return;
      }
      setNearbyRFQs([]);
      setError(fetchError.response?.data?.message || 'Yakin talepler alinamadi.');
    } finally {
      setNearbyLoading(false);
    }
  }, [fetchNearbyByCoords, handleAuthFailure, userCoords]);

  useEffect(() => {
    fetchNearby();
  }, [fetchNearby, pathname, filters]);

  useEffect(() => {
    const payload = {
      selectedCity: filters.city || '',
      selectedKm: Number(filters.radius) || 0
    };
    localStorage.setItem('rfq_header_filter', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('rfq-filter-change', { detail: payload }));
  }, [filters.city, filters.radius]);

  useEffect(
    () => () => {
      if (resultsToastTimerRef.current) {
        window.clearTimeout(resultsToastTimerRef.current);
      }
      if (resultsToastHideTimerRef.current) {
        window.clearTimeout(resultsToastHideTimerRef.current);
      }
      if (createSheetCloseTimerRef.current) {
        window.clearTimeout(createSheetCloseTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const openFilterSheet = () => {
      setDraftFilters({ ...filters });
      setIsFilterSheetOpen(true);
    };
    window.addEventListener('open-rfq-filter-sheet', openFilterSheet);
    return () => {
      window.removeEventListener('open-rfq-filter-sheet', openFilterSheet);
    };
  }, [filters]);

  useEffect(() => {
    if (isFilterSheetOpen) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isFilterSheetOpen]);

  const handleApplyFilters = useCallback(() => {
    const nextFilters = draftFilters || filters;
    if (nextFilters.cityId || nextFilters.city) {
      setSelectedCity(
        nextFilters.cityId || nextFilters.city
          ? { _id: nextFilters.cityId || '', name: nextFilters.city || '' }
          : null
      );
    }
    localStorage.removeItem(RFQ_CACHE_KEY);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      ...nextFilters
    }));
    setIsFilterSheetOpen(false);
    window.dispatchEvent(new CustomEvent('bottomnav:show'));
    setDraftFilters(null);

    if (!nextFilters.city) {
      return;
    }

    if (resultsToastTimerRef.current) {
      window.clearTimeout(resultsToastTimerRef.current);
    }
    if (resultsToastHideTimerRef.current) {
      window.clearTimeout(resultsToastHideTimerRef.current);
    }

    setShowResultsToast(true);
    window.requestAnimationFrame(() => setResultsToastVisible(true));

    resultsToastTimerRef.current = window.setTimeout(() => {
      setResultsToastVisible(false);
      resultsToastHideTimerRef.current = window.setTimeout(() => {
        setShowResultsToast(false);
      }, 300);
    }, 2500);
    fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
  }, [draftFilters, fetchRFQs, filters, resultsToastTimerRef, resultsToastHideTimerRef]);

  const updateDraftFilter = useCallback((key, value) => {
    setDraftFilters((prev) => ({
      ...(prev || filters),
      [key]: value
    }));
  }, [filters]);

  const openCreateSheet = useCallback(() => {
    if (createSheetCloseTimerRef.current) {
      window.clearTimeout(createSheetCloseTimerRef.current);
      createSheetCloseTimerRef.current = null;
    }
    setIsCreateSheetMounted(true);
    window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    window.requestAnimationFrame(() => {
      setCreateSheetState('open-half');
      setCreateSheetDragTranslate(35);
    });
  }, []);

  useEffect(() => {
    const handleOpenCreateSheet = () => openCreateSheet();
    window.addEventListener('open-rfq-create-sheet', handleOpenCreateSheet);
    return () => {
      window.removeEventListener('open-rfq-create-sheet', handleOpenCreateSheet);
    };
  }, [openCreateSheet]);

  const closeCreateSheet = useCallback(() => {
    setCreateSheetState('closed');
    setIsCreateSheetDragging(false);
    setCreateSheetDragTranslate(100);
    window.dispatchEvent(new CustomEvent('bottomnav:show'));
    createSheetCloseTimerRef.current = window.setTimeout(() => {
      setIsCreateSheetMounted(false);
    }, 350);
  }, []);

  useEffect(() => {
    if (isCreateSheetMounted) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isCreateSheetMounted]);

  const getCreateSheetBaseTranslate = useCallback(() => {
    if (createSheetState === 'open-full') {
      return 0;
    }
    if (createSheetState === 'open-half') {
      return 35;
    }
    return 100;
  }, [createSheetState]);

  const handleCreateSheetDragStart = useCallback(
    (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      if (typeof clientY !== 'number') {
        return;
      }
      if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      createSheetDragStartYRef.current = clientY;
      createSheetDragStartTranslateRef.current = getCreateSheetBaseTranslate();
      setIsCreateSheetDragging(true);
      setCreateSheetDragTranslate(createSheetDragStartTranslateRef.current);
    },
    [getCreateSheetBaseTranslate]
  );

  useEffect(() => {
    if (!isCreateSheetDragging) {
      return undefined;
    }

    const onMove = (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      if (typeof clientY !== 'number') {
        return;
      }
      const deltaY = clientY - createSheetDragStartYRef.current;
      const viewportHeight = Math.max(window.innerHeight * 0.85, 1);
      const deltaPercent = (deltaY / viewportHeight) * 100;
      const next = Math.max(0, Math.min(100, createSheetDragStartTranslateRef.current + deltaPercent));
      setCreateSheetDragTranslate(next);
    };

    const onEnd = () => {
      const current = createSheetDragTranslate;
      setIsCreateSheetDragging(false);

      if (current >= 80) {
        closeCreateSheet();
        return;
      }

      if (current <= 20) {
        setCreateSheetState('open-full');
        setCreateSheetDragTranslate(0);
        return;
      }

      setCreateSheetState('open-half');
      setCreateSheetDragTranslate(35);
    };

    document.body.classList.add('sheet-dragging');
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);

    return () => {
      document.body.classList.remove('sheet-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };
  }, [closeCreateSheet, createSheetDragTranslate, isCreateSheetDragging]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || error) {
      return;
    }

    fetchRFQs({ nextPage: page + 1, replace: false });
  }, [error, fetchRFQs, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    if (!loadMoreRef.current) {
      return undefined;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 150px 0px',
        threshold: 0
      }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore]);

  const formatDate = useCallback((dateValue) => {
    if (!dateValue) {
      return '-';
    }

    return new Date(dateValue).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }, []);

  const onPullStart = useCallback((event) => {
    if (window.scrollY === 0) {
      pullStartYRef.current = event.touches[0].clientY;
    }
  }, []);

  const onPullMove = useCallback((event) => {
    if (pullStartYRef.current === null) {
      return;
    }

    const deltaY = event.touches[0].clientY - pullStartYRef.current;
    if (deltaY > 0) {
      setPullDistance(Math.min(deltaY, 90));
    }
  }, []);

  const onPullEnd = useCallback(async () => {
    if (pullDistance >= 70) {
      triggerHaptic(10);
      await fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
    }

    pullStartYRef.current = null;
    setPullDistance(0);
  }, [fetchRFQs, pullDistance]);

  const getBuyerId = useCallback((rfq) => (typeof rfq.buyer === 'object' ? rfq.buyer?._id : rfq.buyer), []);

  const onCardTouchStart = useCallback((rfqId, event) => {
    touchStartXRef.current[rfqId] = event.touches[0].clientX;
  }, []);

  const onCardTouchMove = useCallback((rfqId, event) => {
    const startX = touchStartXRef.current[rfqId];
    if (typeof startX !== 'number') {
      return;
    }

    const deltaX = event.touches[0].clientX - startX;
    const nextOffset = Math.max(-120, Math.min(0, deltaX));

    if (nextOffset < 0) {
      setSwipedCard({ id: rfqId, offset: nextOffset });
    }
  }, []);

  const onCardTouchEnd = useCallback(
    (rfqId) => {
      const isOpen = swipedCard.id === rfqId && swipedCard.offset <= -60;
      setSwipedCard(isOpen ? { id: rfqId, offset: -104 } : { id: null, offset: 0 });
      delete touchStartXRef.current[rfqId];
    },
    [swipedCard]
  );

  const closeSwipeActions = useCallback(() => {
    setSwipedCard({ id: null, offset: 0 });
  }, []);

  const handleCloseRFQ = useCallback(
    async (rfqId) => {
      try {
        await api.patch(`/rfq/${rfqId}/close`);
        triggerHaptic(10);
        closeSwipeActions();
        await fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
      } catch (closeError) {
        setError(closeError.response?.data?.message || 'Talep kapatilamadi.');
      }
    },
    [closeSwipeActions, fetchRFQs]
  );

  const toRadians = useCallback((value) => (value * Math.PI) / 180, []);

  const distanceInKm = useCallback(
    (fromLat, fromLng, toLat, toLng) => {
      const earthRadius = 6371;
      const dLat = toRadians(toLat - fromLat);
      const dLng = toRadians(toLng - fromLng);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadius * c;
    },
    [toRadians]
  );

  const getCategoryName = useCallback((categoryValue) => {
    if (!categoryValue) {
      return '';
    }

    if (typeof categoryValue === 'string') {
      return categoryValue;
    }

    if (typeof categoryValue === 'object') {
      return categoryValue.name || categoryValue.slug || '';
    }

    return '';
  }, []);

  const getCategoryKey = useCallback((item) => {
    const categoryValue = item?.category;
    if (!categoryValue) {
      return '';
    }

    if (typeof categoryValue === 'string') {
      return categoryValue;
    }

    if (typeof categoryValue === 'object') {
      return String(categoryValue._id || categoryValue.slug || categoryValue.name || '');
    }

    return '';
  }, []);

  const getCategoryPlaceholder = useCallback((category) => {
    const value = String(getCategoryName(category) || '').toLowerCase();
    if (value.includes('elektronik')) {
      return '/placeholders/electronics.svg';
    }
    if (value.includes('mobilya')) {
      return '/placeholders/furniture.svg';
    }
    if (value.includes('hizmet')) {
      return '/placeholders/service.svg';
    }
    return '/placeholders/default.svg';
  }, [getCategoryName]);

  const getCardImages = useCallback(
    (rfq) => {
      if (Array.isArray(rfq.images) && rfq.images.length > 0) {
        return rfq.images.map((img) => `${BACKEND_ORIGIN}${img}`);
      }
      return [getCategoryPlaceholder(rfq.category)];
    },
    [BACKEND_ORIGIN, getCategoryPlaceholder]
  );

  const onImageTouchStart = useCallback((rfqId, event) => {
    event.stopPropagation();
    imageTouchStartXRef.current[rfqId] = event.touches[0].clientX;
  }, []);

  const onImageTouchMove = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const onImageTouchEnd = useCallback((rfqId, totalImages, event) => {
    event.stopPropagation();

    if (!totalImages || totalImages < 2) {
      return;
    }

    const startX = imageTouchStartXRef.current[rfqId];
    if (typeof startX !== 'number') {
      return;
    }

    const endX = event.changedTouches[0].clientX;
    const deltaX = endX - startX;
    const threshold = 50;

    setImageIndexes((prev) => {
      const current = prev[rfqId] || 0;
      if (deltaX <= -threshold) {
        return {
          ...prev,
          [rfqId]: Math.min(current + 1, totalImages - 1)
        };
      }
      if (deltaX >= threshold) {
        return {
          ...prev,
          [rfqId]: Math.max(current - 1, 0)
        };
      }
      return prev;
    });

    delete imageTouchStartXRef.current[rfqId];
  }, []);

  const enrichedRFQs = useMemo(() => {
    return rfqs.map((rfq) => {
      const isPremium = isPremiumRFQ(rfq);
      const rfqCoords = getRFQCoords(rfq);
      const distanceKm =
        typeof rfq?.distance === 'number'
          ? rfq.distance / 1000
          : userCoords && rfqCoords
            ? distanceInKm(userCoords.lat, userCoords.lng, Number(rfqCoords.lat), Number(rfqCoords.lng))
            : null;
      const isNearby = typeof distanceKm === 'number' ? distanceKm <= 30 : false;

      return {
        ...rfq,
        isPremium,
        distanceKm,
        isNearby
      };
    });
  }, [distanceInKm, getRFQCoords, isPremiumRFQ, rfqs, userCoords]);

  const filteredEnrichedRFQs = useMemo(() => {
    return enrichedRFQs.filter((item) => {
      const cityMatch = filters.city ? String(getCityName(item)).toLowerCase() === String(filters.city).toLowerCase() : true;
      const districtMatch = filters.district
        ? String(getDistrictName(item)).toLowerCase() === String(filters.district).toLowerCase()
        : true;
      const categoryMatch = filters.category ? getCategoryKey(item) === String(filters.category) : true;
      return cityMatch && districtMatch && categoryMatch;
    });
  }, [enrichedRFQs, filters.category, filters.city, filters.district, getCategoryKey, getCityName, getDistrictName]);

  const filteredNearbyRFQs = useMemo(() => {
    return nearbyRFQs.filter((item) => {
      const cityMatch = filters.city ? String(getCityName(item)).toLowerCase() === String(filters.city).toLowerCase() : true;
      const districtMatch = filters.district
        ? String(getDistrictName(item)).toLowerCase() === String(filters.district).toLowerCase()
        : true;
      const categoryMatch = filters.category ? getCategoryKey(item) === String(filters.category) : true;
      return cityMatch && districtMatch && categoryMatch;
    });
  }, [filters.category, filters.city, filters.district, getCategoryKey, getCityName, getDistrictName, nearbyRFQs]);

  const applySort = useCallback(
    (items = []) => {
      const next = [...items];
      const getPrice = (x) => {
        const raw = x?.targetPrice ?? x?.price;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      const getDate = (x) => {
        const raw = x?.createdAt ?? x?.updatedAt ?? x?.date ?? x?.created_at;
        const t = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(t) ? t : 0;
      };
      switch (sortKey) {
        case 'price_desc':
          return next.sort((a, b) => {
            const aPrice = getPrice(a);
            const bPrice = getPrice(b);
            if (aPrice == null && bPrice == null) return 0;
            if (aPrice == null) return 1;
            if (bPrice == null) return -1;
            return bPrice - aPrice;
          });
        case 'price_asc':
          return next.sort((a, b) => {
            const aPrice = getPrice(a);
            const bPrice = getPrice(b);
            if (aPrice == null && bPrice == null) return 0;
            if (aPrice == null) return 1;
            if (bPrice == null) return -1;
            return aPrice - bPrice;
          });
        case 'date_asc':
          return next.sort((a, b) => getDate(a) - getDate(b));
        case 'date_desc':
        default:
          return next.sort((a, b) => getDate(b) - getDate(a));
      }
    },
    [sortKey]
  );

  const featuredRFQs = useMemo(() => {
    const favoriteCategories = new Set(favoriteItems.map((item) => getCategoryKey(item)).filter(Boolean));
    const scoreByCategory = (item) => {
      if (!favoriteCategories.size) {
        return 0;
      }
      return favoriteCategories.has(getCategoryKey(item)) ? 1 : 0;
    };

    if (filteredNearbyRFQs.length) {
      const nearbyEnriched = filteredNearbyRFQs.map((rfq) => {
        const existing = filteredEnrichedRFQs.find((item) => item._id === rfq._id);
        return existing || rfq;
      });
      const sortedByRecommendation = [...nearbyEnriched].sort((a, b) => scoreByCategory(b) - scoreByCategory(a));
      return applySort(sortedByRecommendation).slice(0, 5);
    }

    const sorted = [...filteredEnrichedRFQs].sort((a, b) => {
      const scoreA = scoreByCategory(a);
      const scoreB = scoreByCategory(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      if (a.isPremium !== b.isPremium) {
        return a.isPremium ? -1 : 1;
      }

      if (a.isNearby !== b.isNearby) {
        return a.isNearby ? -1 : 1;
      }

      if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
        return a.distanceKm - b.distanceKm;
      }

      if (typeof a.distanceKm === 'number') {
        return -1;
      }

      if (typeof b.distanceKm === 'number') {
        return 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const highlighted = sorted.filter((item) => item.isPremium || item.isNearby);
    if (highlighted.length === 0) {
      return sorted.slice(0, 5);
    }

    return applySort(highlighted).slice(0, 5);
  }, [applySort, favoriteItems, filteredEnrichedRFQs, filteredNearbyRFQs, getCategoryKey]);

  const sortPremiumFirst = useCallback(
    (items = []) =>
      [...items].sort((a, b) => {
        const aFeatured = isFeaturedRFQ(a);
        const bFeatured = isFeaturedRFQ(b);
        if (aFeatured && !bFeatured) {
          return -1;
        }
        if (!aFeatured && bFeatured) {
          return 1;
        }
        const aPremium = isPremiumRFQ(a);
        const bPremium = isPremiumRFQ(b);
        if (aPremium && !bPremium) {
          return -1;
        }
        if (!aPremium && bPremium) {
          return 1;
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }),
    [isFeaturedRFQ, isPremiumRFQ]
  );

  const featuredIds = useMemo(() => new Set(featuredRFQs.map((item) => item._id)), [featuredRFQs]);

  const nearbyOnlyRFQs = useMemo(() => {
    const source = filteredNearbyRFQs.length ? filteredNearbyRFQs : filteredEnrichedRFQs.filter((item) => item.isNearby);
    const filtered = source.filter((item) => !featuredIds.has(item._id));
    const favoriteCategories = new Set(favoriteItems.map((item) => getCategoryKey(item)).filter(Boolean));

    if (!favoriteCategories.size) {
      return applySort(filtered);
    }

    const recommended = [...filtered].sort((a, b) => {
      const scoreA = favoriteCategories.has(getCategoryKey(a)) ? 1 : 0;
      const scoreB = favoriteCategories.has(getCategoryKey(b)) ? 1 : 0;
      return scoreB - scoreA;
    });
    return applySort(recommended);
  }, [applySort, favoriteItems, featuredIds, filteredEnrichedRFQs, filteredNearbyRFQs, getCategoryKey]);
  const featuredRFQsSorted = useMemo(() => sortPremiumFirst(featuredRFQs), [featuredRFQs, sortPremiumFirst]);
  const nearbyOnlyRFQsSorted = useMemo(() => sortPremiumFirst(nearbyOnlyRFQs), [nearbyOnlyRFQs, sortPremiumFirst]);
  const premiumUnderFeaturedRFQs = useMemo(
    () => nearbyOnlyRFQsSorted.filter((item) => isPremiumRFQ(item)),
    [isPremiumRFQ, nearbyOnlyRFQsSorted]
  );
  const normalRFQs = useMemo(
    () => nearbyOnlyRFQsSorted.filter((item) => !isPremiumRFQ(item)),
    [isPremiumRFQ, nearbyOnlyRFQsSorted]
  );
  const orderedRFQs = useMemo(() => {
    const combined = [...featuredRFQsSorted, ...premiumUnderFeaturedRFQs, ...normalRFQs];
    const featured = combined.filter((item) => isFeaturedRFQ(item));
    const rest = combined.filter((item) => !isFeaturedRFQ(item));
    return [...featured, ...rest];
  }, [featuredRFQsSorted, normalRFQs, premiumUnderFeaturedRFQs, isFeaturedRFQ]);
  const hasDistanceData = useMemo(
    () =>
      filteredNearbyRFQs.some(
        (item) => Number.isFinite(Number(item?.distanceKm)) || Number.isFinite(Number(item?.distance))
      ),
    [filteredNearbyRFQs]
  );
  const filteredOrderedRFQs = orderedRFQs;
  const selectedCityLabel = useMemo(() => filters.city || selectedCity?.name || 'Seçili Şehir', [filters.city, selectedCity?.name]);
  const mapRadiusCenter = liveLocation;
  const hasRadiusCenter = Boolean(mapRadiusCenter && Number.isFinite(mapRadiusCenter.lat) && Number.isFinite(mapRadiusCenter.lng));
  const quickFilteredRFQs = useMemo(() => {
    let items = filteredOrderedRFQs;
    if (sortKey !== 'advanced') {
      const arr = [...items];
      const getPrice = (x) => Number(x?.price ?? x?.budget ?? x?.amount ?? 0);
      const getKm = (x) => {
        const v = x?.distanceKm ?? x?.km ?? x?.distance;
        const n = Number(v);
        return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
      };
      const getDate = (x) => {
        const raw = x?.createdAt ?? x?.date ?? x?.created_at;
        const t = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(t) ? t : 0;
      };

      switch (sortKey) {
        case 'price_desc':
          arr.sort((a, b) => getPrice(b) - getPrice(a));
          break;
        case 'price_asc':
          arr.sort((a, b) => getPrice(a) - getPrice(b));
          break;
        case 'date_desc':
          arr.sort((a, b) => getDate(b) - getDate(a));
          break;
        case 'date_asc':
          arr.sort((a, b) => getDate(a) - getDate(b));
          break;
        case 'km_asc':
          arr.sort((a, b) => getKm(a) - getKm(b));
          break;
        case 'km_desc':
          arr.sort((a, b) => getKm(b) - getKm(a));
          break;
        default:
          break;
      }
      items = arr;
    }

    return items;
  }, [filteredOrderedRFQs, sortKey]);

  const radiusFilteredRFQs = useMemo(() => {
    if (!hasRadiusCenter || mapRadiusKm <= 0) {
      return quickFilteredRFQs;
    }
    return quickFilteredRFQs.filter((item) => {
      const coords = getRFQCoords(item);
      if (!coords) {
        return false;
      }
      const distance = getDistanceKm(mapRadiusCenter, coords);
      return typeof distance === 'number' && distance <= mapRadiusKm;
    });
  }, [getRFQCoords, hasRadiusCenter, mapRadiusCenter, mapRadiusKm, quickFilteredRFQs]);

  useEffect(() => {
    localStorage.setItem('rfq_sortKey', sortKey);
    setFilters((prev) => ({ ...prev, sort: sortKey }));
  }, [sortKey]);

  const mapSourceItems = useMemo(() => (Array.isArray(radiusFilteredRFQs) ? radiusFilteredRFQs : []), [radiusFilteredRFQs]);

  const mapBaseItems = useMemo(() => {
    return [...mapSourceItems]
      .filter((item) => Boolean(getRFQCoords(item)))
      .filter((item) => (!showActiveOnly ? true : isActiveRequest(item, nowTs)));
  }, [getRFQCoords, mapSourceItems, nowTs, showActiveOnly]);

  const mapItems = useMemo(() => {
    let items = mapBaseItems;
    if (hasRadiusCenter && mapRadiusKm > 0) {
      items = items.filter((item) => {
        const coords = getRFQCoords(item);
        if (!coords) {
          return false;
        }
        const distance = getDistanceKm(mapRadiusCenter, coords);
        return typeof distance === 'number' && distance <= mapRadiusKm;
      });
    }

    if (!mapAreaFilterActive || !mapBounds) {
      return items;
    }

    if (!mapAreaFilterIds) {
      return items;
    }

    const filtered = items.filter((item) => mapAreaFilterIds.has(String(item._id)));
    return Array.isArray(filtered) ? filtered : [];
  }, [getRFQCoords, hasRadiusCenter, mapAreaFilterActive, mapAreaFilterIds, mapBaseItems, mapBounds, mapRadiusCenter, mapRadiusKm]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current || mapAreaFilterActive) {
      return;
    }
    if (!mapItems.length) {
      return;
    }

    const coordsList = mapItems
      .map((item) => getRFQCoords(item))
      .filter(Boolean)
      .map((coords) => L.latLng(coords.lat, coords.lng));

    if (!coordsList.length) {
      return;
    }

    if (coordsList.length === 1) {
      mapRef.current.setView(coordsList[0], Math.max(12, mapRef.current.getZoom()));
      return;
    }

    const bounds = L.latLngBounds(coordsList);
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [getRFQCoords, mapAreaFilterActive, mapItems, viewMode]);

  const mapCenter = useMemo(() => {
    if (userCoords) {
      return [userCoords.lat, userCoords.lng];
    }
    if (mapItems.length) {
      const coords = getRFQCoords(mapItems[0]);
      if (coords) {
        return [coords.lat, coords.lng];
      }
    }
    return [41.0082, 28.9784];
  }, [getRFQCoords, mapItems, userCoords]);

  const listIsEmpty = radiusFilteredRFQs.length === 0;
  const mapIsEmpty = mapItems.length === 0;
  const hasCityFilter = Boolean(filters.city || selectedCity?.name);
  const selectedKm = Number(filters.radius) || 0;
  const canApplyFilters = Boolean((draftFilters || filters).city || (draftFilters || filters).cityId);
  const hasMapCoords = mapBaseItems.length > 0;

  const handleIncreaseKm = useCallback(() => {
    window.dispatchEvent(new Event('open-rfq-filter-sheet'));
    window.setTimeout(() => {
      const input = document.getElementById('radiusRange');
      if (input) {
        input.focus();
      }
    }, 250);
  }, []);

  const handleSelectCity = useCallback(() => {
    window.dispatchEvent(new Event('open-rfq-filter-sheet'));
    window.setTimeout(() => {
      const input = document.querySelector('.city-search-input');
      if (input) {
        input.focus();
      }
    }, 250);
  }, []);

  const saveSearchHistory = useCallback((next) => {
    setSearchHistory(next);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  }, []);

  const pushSearchHistory = useCallback(
    (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) {
        return;
      }
      const prev = Array.isArray(searchHistory) ? searchHistory : [];
      const without = prev.filter((item) => String(item || '').toLowerCase() !== normalized.toLowerCase());
      const next = [normalized, ...without].slice(0, 8);
      saveSearchHistory(next);
    },
    [saveSearchHistory, searchHistory]
  );

  useEffect(() => {
    const nextRadius = Number(filters.radius) || 0;
    const timer = window.setTimeout(() => {
      setMapRadiusKm(nextRadius);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters.radius]);

  const closeSearchSheet = useCallback(() => {
    pushSearchHistory(searchQuery);
    setIsSearchSheetOpen(false);
  }, [pushSearchHistory, searchQuery]);

  const handleCreateRFQ = useCallback(() => {
    window.dispatchEvent(new Event('open-rfq-create-sheet'));
  }, []);

  const handleRetry = useCallback(() => {
    fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
    fetchNearby();
  }, [fetchNearby, fetchRFQs]);

  const toggleLiveLocation = useCallback(() => {
    if (liveStatus === 'active' || liveStatus === 'requesting') {
      stopLiveLocation();
      setUserPosition(null);
      setUserCoords(null);
      return;
    }
    startLiveLocation();
  }, [liveStatus, startLiveLocation, stopLiveLocation]);

  const handleSearchThisArea = useCallback(() => {
    if (!mapBounds) {
      return;
    }

    const nextIds = new Set();
    mapBaseItems.forEach((item) => {
      const coords = getRFQCoords(item);
      if (!coords) {
        return;
      }
      const within =
        coords.lat >= mapBounds.south &&
        coords.lat <= mapBounds.north &&
        coords.lng >= mapBounds.west &&
        coords.lng <= mapBounds.east;
      if (within) {
        nextIds.add(String(item._id));
      }
    });
    setMapAreaFilterIds(nextIds);
    setMapAreaFilterActive(true);
    setMapHasMoved(false);
  }, [getRFQCoords, mapBaseItems, mapBounds]);

  const mapTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const mapAttribution = '&copy; OpenStreetMap contributors &copy; CARTO';

  const createMarkerIcon = useCallback(
    (title, subTitle, isPremium, isNew, isActive, isFeatured) =>
      L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-badge ${isPremium ? 'premium-marker' : ''} ${isNew ? 'new-rfq-marker' : ''} ${isDarkMode ? 'dark-marker' : ''} ${!isActive ? 'inactive-marker' : ''}"><div class="marker-title">${escapeHtml(isFeatured ? `⭐ Öne ${title}` : title)}</div><div class="marker-sub">${escapeHtml(subTitle)}</div></div>`,
        iconSize: [150, 44],
        iconAnchor: [75, 44]
      }),
    [isDarkMode]
  );

  const userMarkerIcon = useMemo(
    () =>
      L.divIcon({
        html: '<div class="user-marker"></div>',
        className: 'user-live-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
    []
  );

  const createClusterIcon = useCallback(
    (cluster) => {
      const count = cluster.getChildCount();
      const baseSize = 52 - mapZoom * 1.3 + count * 0.28;
      const size = Math.max(32, Math.min(60, Math.round(baseSize)));
      const hasPremiumChild = cluster.getAllChildMarkers().some((marker) => Boolean(marker.options?.isPremium));

      return L.divIcon({
        html: `<div class="cluster-bubble ${hasPremiumChild ? 'premium-cluster' : ''} ${isDarkMode ? 'dark-cluster' : ''}">${count}</div>`,
        className: 'custom-cluster',
        iconSize: L.point(size, size)
      });
    },
    [isDarkMode, mapZoom]
  );

  const selectedRfqCoords = useMemo(() => {
    if (!selectedRfq) {
      return null;
    }
    return getRFQCoords(selectedRfq);
  }, [getRFQCoords, selectedRfq]);

  const routePoints = useMemo(() => {
    if (!userPosition || !selectedRfqCoords) {
      return null;
    }
    return [
      [userPosition.lat, userPosition.lng],
      [selectedRfqCoords.lat, selectedRfqCoords.lng]
    ];
  }, [selectedRfqCoords, userPosition]);

  useEffect(() => {
    if (!routePoints) {
      setRouteSummary(null);
      return;
    }

    const distanceKm = calculateDistance(
      routePoints[0][0],
      routePoints[0][1],
      routePoints[1][0],
      routePoints[1][1]
    );
    const durationMin = (distanceKm / 35) * 60;
    setRouteSummary({ distanceKm, durationMin });
  }, [routePoints]);

  const cityOptions = useMemo(() => {
    const namesFromData = [...rfqs, ...nearbyRFQs].map((item) => getCityName(item)).filter(Boolean);
    return Array.from(new Set(namesFromData)).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [getCityName, nearbyRFQs, rfqs]);

  useEffect(() => {
    let isActive = true;

    const fetchInlineCategories = async () => {
      try {
        const response = await api.get('/categories');
        const flat = response.data?.data || response.data?.items || [];
        const map = {};
        const roots = [];

        flat.forEach((cat) => {
          map[String(cat._id)] = { ...cat, children: [] };
        });

        flat.forEach((cat) => {
          const parentId = cat.parent ? String(typeof cat.parent === 'object' ? cat.parent._id : cat.parent) : null;
          if (parentId && map[parentId]) {
            map[parentId].children.push(map[String(cat._id)]);
          } else {
            roots.push(map[String(cat._id)]);
          }
        });

        const leafItems = Object.values(map).filter((item) => !item.children?.length);
        leafItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
        const subcats = [];
        roots.forEach((parent) => {
          if (!parent?.children?.length) return;
          parent.children.forEach((child) => {
            subcats.push({
              ...child,
              parentId: parent._id,
              parentName: parent.name
            });
          });
        });
        subcats.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));

        if (isActive) {
          setInlineSubcategories(leafItems);
          setFlatSubcategories(subcats);
        }
      } catch (requestError) {
        if (isActive) {
          setInlineSubcategories([]);
          setFlatSubcategories([]);
        }
      }
    };

    fetchInlineCategories();

    return () => {
      isActive = false;
    };
  }, []);

  const handleCategorySelect = useCallback(
    (category) => {
      updateFilter('category', String(category._id));
      setCategoryLabel(Array.isArray(category.path) ? category.path.join(' > ') : category.name || '');
      setIsCategoryModalOpen(false);
    },
    [updateFilter]
  );

  const handleClearCategoryFilter = useCallback(() => {
    updateFilter('category', null);
    setCategoryLabel('');
    setIsCategoryModalOpen(false);
  }, [updateFilter]);

  const normalizeSearch = useCallback((value) => String(value || '').toLowerCase().trim(), []);

  const activeParentName = useMemo(() => {
    const selectedId = String(filters.category || '');
    if (!selectedId) return '';
    const match = flatSubcategories.find((item) => String(item._id) === selectedId);
    return match?.parentName || '';
  }, [filters.category, flatSubcategories]);

  const suggestionResults = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return [];
    const results = flatSubcategories.filter((item) =>
      normalizeSearch(item.name).includes(query)
    );
    results.sort((a, b) => {
      const aName = normalizeSearch(a.name);
      const bName = normalizeSearch(b.name);
      const aExact = aName === query ? 1 : 0;
      const bExact = bName === query ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return aName.localeCompare(bName, 'tr');
    });
    return results.slice(0, 10);
  }, [flatSubcategories, normalizeSearch, searchQuery]);

  const handleSuggestSelect = useCallback(
    (item) => {
      updateFilter('category', String(item._id));
      setCategoryLabel(`${item.parentName} > ${item.name}`);
      closeSearchSheet();
    },
    [closeSearchSheet, updateFilter]
  );

  const renderRFQCard = useCallback(
    (rfq, index, baseDelay = 0, variant = 'normal') => {
      const buyerId = getBuyerId(rfq);
      const isOwner = Boolean(currentUserId && buyerId === currentUserId);
      const isOpened = swipedCard.id === rfq._id;
      const statusClass = rfq.status === 'awarded' ? 'done' : 'open';
      const statusLabel = rfq.status === 'awarded' ? 'Tamamlandi' : 'Acik';
      const images = getCardImages(rfq);
      const currentImageIndex = imageIndexes[rfq._id] || 0;
      const isFavorite = favorites.includes(String(rfq._id));
      const animating = Boolean(favoriteAnimating[rfq._id]);
      const isFeatured = isFeaturedRFQ(rfq) || (import.meta.env.DEV && index === 0);
      const isPremium = Boolean(rfq?.isPremium) || (import.meta.env.DEV && index === 1);

      const toggleFavorite = async (event) => {
        event.stopPropagation();

        if (!currentUserId) {
          navigate('/login');
          return;
        }

        setFavoriteAnimating((prev) => ({ ...prev, [rfq._id]: true }));
        window.setTimeout(() => {
          setFavoriteAnimating((prev) => ({ ...prev, [rfq._id]: false }));
        }, 200);

        try {
          const response = await api.post(`/users/favorite/${rfq._id}`);
          const serverFavorites = (response.data?.favorites || []).map((item) => String(item));
          const nextFavoriteCount = Number(response.data?.favoriteCount || 0);
          const isNowFavorite = serverFavorites.includes(String(rfq._id));

          setFavorites(serverFavorites);
          setFavoriteItems((prev) => {
            if (isNowFavorite) {
              if (prev.some((item) => String(item._id) === String(rfq._id))) {
                return prev;
              }
              return [...prev, { _id: rfq._id, category: rfq.category }];
            }

            return prev.filter((item) => String(item._id) !== String(rfq._id));
          });
          setToast(isNowFavorite ? 'Favorilere eklendi' : 'Favoriden cikarildi');
          window.setTimeout(() => {
            setToast(null);
          }, 3000);

          setRfqs((prev) =>
            prev.map((item) => (item._id === rfq._id ? { ...item, favoriteCount: nextFavoriteCount } : item))
          );
          setNearbyRFQs((prev) =>
            prev.map((item) => (item._id === rfq._id ? { ...item, favoriteCount: nextFavoriteCount } : item))
          );
        } catch (toggleError) {
          setToast(toggleError.response?.data?.message || 'Favori islemi basarisiz.');
          window.setTimeout(() => {
            setToast(null);
          }, 3000);
        }
      };

      return (
        <motion.div
          key={rfq._id}
          className="rfq-swipe-wrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: (index + baseDelay) * 0.05 }}
        >
          <div className="rfq-actions">
            <button type="button" className="secondary-btn swipe-btn" onClick={() => navigate(`/rfq/${rfq._id}`)}>
              Detay
            </button>
            {isOwner ? (
              <button type="button" className="danger-btn swipe-btn" onClick={() => handleCloseRFQ(rfq._id)}>
                Kapat
              </button>
            ) : null}
          </div>

          <article
            className={`card rfq-card rfq-clickable ${isFavorite ? 'favorite' : ''} ${isFeatured ? 'featured-card' : ''} ${isPremium && !isFeatured ? 'premium-card' : ''}`}
            style={{ transform: `translateX(${isOpened ? swipedCard.offset : 0}px)` }}
            onTouchStart={(event) => onCardTouchStart(rfq._id, event)}
            onTouchMove={(event) => onCardTouchMove(rfq._id, event)}
            onTouchEnd={() => onCardTouchEnd(rfq._id)}
            onClick={() => {
              if (isOpened) {
                closeSwipeActions();
                return;
              }

              navigate(`/rfq/${rfq._id}`);
            }}
            >
            {isFeatured ? <span className="card-state-badge featured">Öne Çıkarıldı</span> : null}
            {!isFeatured && isPremium ? <span className="card-state-badge premium">PREMIUM</span> : null}
            <div className="favorite-btn" onClick={toggleFavorite}>
              <div className="favorite-wrapper">
                <FavoriteIcon size={20} active={isFavorite} className={animating ? 'favorite-animating' : ''} />
              </div>
            </div>
            <div
              className="rfq-media"
              onTouchStart={(event) => onImageTouchStart(rfq._id, event)}
              onTouchMove={onImageTouchMove}
              onTouchEnd={(event) => onImageTouchEnd(rfq._id, images.length, event)}
            >
              <div className="image-slider" style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}>
                {images.map((img, imageIndex) => (
                  <img
                    key={`${rfq._id}-${imageIndex}`}
                    src={img}
                    className="rfq-image"
                    alt="rfq"
                    loading="lazy"
                  />
                ))}
              </div>
              <div className="overlay" />
              <h3 className="rfq-image-title">{rfq.title}</h3>
              {images.length > 1 ? (
                <div className="dots">
                  {images.map((_, dotIndex) => (
                    <span
                      key={`${rfq._id}-dot-${dotIndex}`}
                      className={dotIndex === currentImageIndex ? 'dot active' : 'dot'}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rfq-sub">Kategori: {getCategoryName(rfq.category) || '-'}</div>
            {rfq.car?.brandName || rfq.car?.modelName ? (
              <div className="rfq-sub">
                {rfq.car?.brandName || ''} {rfq.car?.modelName || ''}
              </div>
            ) : null}
            {getCityName(rfq) ? <div className="rfq-sub">Konum: {getCityName(rfq)}{getDistrictName(rfq) ? ` / ${getDistrictName(rfq)}` : ''}</div> : null}
            <div className="rfq-sub">Miktar: {rfq.quantity}</div>

            <div className="rfq-badges">
              <span className="deadline-badge">Termin: {formatDate(rfq.deadline)}</span>
              <span className={`badge ${statusClass}`}>{statusLabel}</span>
              {rfq.isAuction ? <span className="premium-badge">Canli Acik Arttirma</span> : null}
            </div>
            {rfq.isAuction ? (
              <div className="rfq-sub">En Iyi Teklif: {rfq.currentBestOffer ? `${rfq.currentBestOffer} TL` : 'Henuz yok'}</div>
            ) : null}

            {rfq?.distance ? (
              <div className="distance-text">📍 {(rfq.distance / 1000).toFixed(1)} km uzakta</div>
            ) : typeof rfq.distanceKm === 'number' ? (
              <div className="distance-text">📍 {rfq.distanceKm.toFixed(1)} km uzakta</div>
            ) : null}
          </article>
        </motion.div>
      );
    },
    [
      closeSwipeActions,
      currentUserId,
      favorites,
      favoriteAnimating,
      formatDate,
      getBuyerId,
      getCardImages,
      getCategoryName,
      getCityName,
      getDistrictName,
      handleCloseRFQ,
      imageIndexes,
      navigate,
      onCardTouchEnd,
      onCardTouchMove,
      onCardTouchStart,
      onImageTouchEnd,
      onImageTouchMove,
      onImageTouchStart,
      swipedCard
    ]
  );

  return (
    <div className={viewMode === 'map' ? 'rfq-list-page map-mode' : 'rfq-list-page'} onTouchStart={onPullStart} onTouchMove={onPullMove} onTouchEnd={onPullEnd}>
      <div className="ui-rev-watermark">UI REV 1</div>
      <div className="pull-indicator" style={{ height: `${pullDistance}px` }}>
        {pullDistance > 0 ? <span className="spinner" /> : null}
      </div>

      {locationWarning && !showLocationModal ? <div className="location-error-box">{locationWarning}</div> : null}

      {error && viewMode === 'list' ? (
        <ErrorStateCard
          title="Bağlantı sorunu"
          message="Talepler yüklenemedi. İnterneti kontrol edip tekrar dene."
          onRetry={handleRetry}
        />
      ) : null}

      <div className="view-toggle">
        <button
          type="button"
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
        >
          Liste
        </button>
        <button
          type="button"
          className={viewMode === 'map' ? 'active' : ''}
          onClick={() => setViewMode('map')}
        >
          Harita
        </button>
      </div>

      <div className="home-filters">
        <div className="cats-header-row">
          <button
            type="button"
            className="secondary-btn home-filter-btn cats-title-btn"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            {categoryLabel || 'Tüm Kategoriler'}
          </button>
          {categoryLabel ? (
            <button
              type="button"
              className="mini-clear-btn"
              onClick={handleClearCategoryFilter}
              aria-label="Kategori secimini kaldir"
            >
              ×
            </button>
          ) : null}
          <div className="cats-inline-wrap">
            <span className="cats-fade left" aria-hidden="true" />
            <div className="cats-inline-scroll">
              {inlineSubcategories.map((subcat) => {
                const isActive = String(filters.category || '') === String(subcat._id || '');
                return (
                  <button
                    key={subcat._id}
                    type="button"
                    className={`cats-inline-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleCategorySelect(subcat)}
                  >
                    {subcat.name}
                  </button>
                );
              })}
            </div>
            <span className="cats-fade right" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div
        className="rfq-search-trigger"
        role="button"
        tabIndex={0}
        onClick={() => setIsSearchSheetOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsSearchSheetOpen(true);
          }
        }}
      >
        <span className="rfq-search-icon" aria-hidden="true">🔍</span>
        <span className="rfq-search-placeholder">Talepleri ara (başlık, kategori…)</span>
        <span className="rfq-search-cta">Ara</span>
      </div>

      {loading ? <RFQSkeletonGrid count={6} /> : null}

      <AnimatePresence mode="wait">
      {!loading && viewMode === 'list' ? (
        <motion.div
          key="list"
          className="mode-fade"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
        >
          <section className="list-section">
            <div className="list-head">
              <h1>{`📍 ${selectedCityLabel}`}</h1>
            </div>

            {nearbyLoading ? <div className="refresh-text">Yukleniyor...</div> : null}

            {listIsEmpty && !nearbyLoading ? (
              <EmptyStateCard
                title={hasCityFilter ? 'Bu bölgede talep yok' : 'Şehir seçerek talepleri gör'}
                description={
                  hasCityFilter
                    ? `${filters.city || selectedCityLabel} • ${selectedKm} km için henüz ilan bulunamadı.`
                    : 'Şehir seçerek bulunduğun bölgedeki talepleri görebilirsin.'
                }
                primaryLabel={hasCityFilter ? 'Talep oluştur' : 'Şehir seç'}
                secondaryLabel={hasCityFilter ? 'Km artır' : null}
                onPrimary={hasCityFilter ? handleCreateRFQ : handleSelectCity}
                onSecondary={hasCityFilter ? handleIncreaseKm : null}
              />
            ) : (
              <div className="rfq-grid">
                {radiusFilteredRFQs.map((rfq, index) => {
                  const cardVariant = featuredIds.has(rfq._id)
                    ? 'featured'
                    : isPremiumRFQ(rfq)
                      ? 'premium'
                      : 'normal';
                  return renderRFQCard(rfq, index, 0, cardVariant);
                })}
              </div>
            )}
          </section>
          {loadingMore ? <RFQSkeletonGrid count={2} /> : null}
        </motion.div>
      ) : null}

      {!loading && viewMode === 'map' ? (
        <motion.div
          key="map"
          className="mode-fade rfq-map-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {nearbyLoading || loading ? (
            <div className="map-overlay">
              <RFQSkeletonGrid count={4} />
            </div>
          ) : null}
          {!nearbyLoading && !loading && error ? (
            <div className="map-overlay">
              <ErrorStateCard title="Harita yüklenemedi" message="Harita verileri alınamadı." onRetry={handleRetry} />
            </div>
          ) : null}
          {!nearbyLoading && !loading && !error && mapIsEmpty ? (
            <div className="map-banner">
              {hasCityFilter ? 'Haritada gösterilecek talep yok.' : 'Şehir seçerek talepleri gör.'}
              <button type="button" className="ghost-btn" onClick={hasCityFilter ? handleIncreaseKm : handleSelectCity}>
                {hasCityFilter ? 'Km artır' : 'Şehir seç'}
              </button>
            </div>
          ) : null}
          {hasMapCoords && mapHasMoved ? (
            <button type="button" className="map-search-area-btn" onClick={handleSearchThisArea}>
              Bu alanı ara
            </button>
          ) : null}
          <div className="map-live-controls">
            <button type="button" className="secondary-btn" onClick={toggleLiveLocation}>
              {liveStatus === 'active' || liveStatus === 'requesting' ? 'Canli konumu kapat' : 'Canli konumu ac'}
            </button>
            {liveStatus === 'active' ? (
              <span className="map-live-status">
                Konum aktif{Number.isFinite(Number(accuracy)) ? ` • ±${Math.round(Number(accuracy))}m` : ''}
              </span>
            ) : (
              <span className="map-live-status">Yaricap filtresi icin canli konumu ac</span>
            )}
          </div>
          <MapContainer
            center={mapCenter}
            zoom={11}
            minZoom={6}
            maxZoom={18}
            scrollWheelZoom
            className="rfq-map"
            whenCreated={(map) => {
              mapRef.current = map;
              const bounds = map.getBounds();
              setMapBounds({
                south: bounds.getSouth(),
                west: bounds.getWest(),
                north: bounds.getNorth(),
                east: bounds.getEast()
              });
            }}
          >
            <MapZoomSync
              onZoomChange={setMapZoom}
              onBoundsChange={(next) =>
                setMapBounds((prev) => {
                  if (
                    prev &&
                    prev.south === next.south &&
                    prev.west === next.west &&
                    prev.north === next.north &&
                    prev.east === next.east
                  ) {
                    return prev;
                  }
                  return next;
                })
              }
              onUserMove={() => setMapHasMoved(true)}
              suppressUpdates={shouldSuppressMapUpdates}
            />
            <TileLayer url={mapTileUrl} attribution={mapAttribution} />
            {liveLocation && mapRadiusKm > 0 ? (
              <Circle center={[liveLocation.lat, liveLocation.lng]} radius={mapRadiusKm * 1000} pathOptions={{ color: '#2563eb', weight: 2, opacity: 0.6, fillOpacity: 0.08 }} />
            ) : null}
            <MarkerClusterGroup
              ref={clusterRef}
              chunkedLoading
              iconCreateFunction={createClusterIcon}
            >
              {mapItems.map((rfq) => {
                const coords = getRFQCoords(rfq);
                if (!coords) {
                  return null;
                }

                const images = getCardImages(rfq);
                const firstImage = images[0];
                const markerCategory =
                  rfq?.category?.name ||
                  rfq?.category?.title ||
                  rfq?.categoryName ||
                  getCategoryName(rfq.category) ||
                  'Kategori';
                const markerSub = rfq?.title || (rfq?.description ? String(rfq.description).slice(0, 40) : 'Talep');
                const premium = isPremiumRFQ(rfq);
                const featured = isFeaturedRFQ(rfq);
                const isActive = isActiveRequest(rfq, nowTs);
                return (
                  <Marker
                    key={rfq._id}
                    position={[coords.lat, coords.lng]}
                    icon={createMarkerIcon(
                      markerCategory,
                      markerSub,
                      premium,
                      Boolean(newRFQMarkers[rfq._id]),
                      isActive,
                      featured
                    )}
                    isPremium={premium}
                    zIndexOffset={featured ? 1200 : premium ? 800 : 0}
                    eventHandlers={{
                      click: () => setSelectedRfq(rfq),
                      popupclose: () => {
                        if (selectedRfq?._id === rfq._id) {
                          setSelectedRfq(null);
                        }
                      }
                    }}
                  >
                    {selectedRfq?._id === rfq._id ? (
                      <Popup autoPan maxWidth={260} minWidth={200} closeButton>
                        <div className="map-popup">
                          {firstImage ? <img src={firstImage} alt={rfq.title} className="map-popup-image" /> : null}
                          <div className="map-popup-category">{markerCategory}</div>
                          <div className="map-popup-sub">{markerSub}</div>
                          <button
                            type="button"
                            className="map-popup-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedRfq(null);
                              navigate(`/rfq/${rfq._id}`);
                            }}
                          >
                            Detay
                          </button>
                        </div>
                      </Popup>
                    ) : null}
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
            {routePoints ? (
              <Polyline positions={routePoints} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }} />
            ) : null}
            {userPosition ? (
              <Marker position={[userPosition.lat, userPosition.lng]} icon={userMarkerIcon} zIndexOffset={1200}>
                <Popup>Konumunuz</Popup>
              </Marker>
            ) : null}
          </MapContainer>

        </motion.div>
      ) : null}
      </AnimatePresence>

      {!loading && hasMore ? <div ref={loadMoreRef} className="load-more-sentinel" /> : null}
      {refreshing ? <div className="refresh-text">Yenileniyor...</div> : null}
      {showResultsToast && filters.city ? (
        <div className={`results-toast ${resultsToastVisible ? 'show' : ''}`}>
          📍 <strong>{filters.city}</strong> icinde <span className="results-km">{filters.radius} km</span> capindaki talepler gosteriliyor
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}

      <ReusableBottomSheet
        open={isSearchSheetOpen}
        onClose={closeSearchSheet}
        title="Talepleri Ara"
        headerRight={(
          <button type="button" className="search-close" onClick={closeSearchSheet}>
            Kapat
          </button>
        )}
        contentClassName="premium-search-sheet"
        initialSnap="mid"
      >
        <div className="search-input-wrap">
          <span className="search-input-icon" aria-hidden="true">🔍</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                pushSearchHistory(searchQuery);
              }
            }}
            placeholder="Başlık, kategori, açıklama..."
            className="search-input"
            ref={searchInputRef}
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
          />
        </div>
        <div className="search-hint">Yazdıkça liste filtrelenecek.</div>

        <div className="search-category-meta">
          <div className="search-meta-title">Ana Kategori</div>
          <div className="search-parent-chip">{activeParentName || 'Kategori secilmedi'}</div>
        </div>

        {suggestionResults.length ? (
          <div className="search-suggestions">
            <div className="search-meta-title">Oneriler</div>
            <div className="search-suggestion-list">
              {suggestionResults.map((item) => (
                <button
                  key={`${item._id}`}
                  type="button"
                  className="suggest-row"
                  onClick={() => handleSuggestSelect(item)}
                >
                  <div className="suggest-title">{item.name}</div>
                  <div className="suggest-meta">{item.parentName}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {searchHistory.length ? (
          <div className="search-history">
            <div className="search-history-head">
              <span>Geçmiş aramalar</span>
              <button
                type="button"
                className="search-history-clear"
                onClick={() => saveSearchHistory([])}
              >
                Temizle
              </button>
            </div>
            <div className="search-history-list">
              {searchHistory.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="search-history-item"
                  onClick={() => setSearchQuery(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </ReusableBottomSheet>

      <ReusableBottomSheet
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Şehir Seç"
        initialSnap="mid"
        headerRight={(
          <button
            type="button"
            className="apply-btn sheet-apply-header"
            onClick={handleApplyFilters}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            disabled={!canApplyFilters}
          >
            Uygula
          </button>
        )}
      >
        <FilterBar
          filters={draftFilters || filters}
          onChange={updateDraftFilter}
          compact={filterCompact}
        />
        <div className="home-sheet-filters">
          <label htmlFor="sheetSort">Gelişmiş sıralama</label>
          <select
            id="sheetSort"
            className="home-filter-select"
            value={(draftFilters || filters).sort}
            onChange={(event) => updateDraftFilter('sort', event.target.value)}
          >
            <option value="price_desc">Fiyata göre (yüksek)</option>
            <option value="price_asc">Fiyata göre (düşük)</option>
            <option value="date_desc">Tarihe göre (yeni ilan)</option>
            <option value="date_asc">Tarihe göre (eski ilan)</option>
          </select>
        </div>
      </ReusableBottomSheet>

      {isCreateSheetMounted ? (
        <div className={`create-sheet-overlay ${createSheetState !== 'closed' ? 'open' : ''}`} onClick={closeCreateSheet}>
          <div
            className={`create-sheet-content create-sheet-${createSheetState} ${isCreateSheetDragging ? 'dragging' : ''}`}
            style={
              isCreateSheetDragging
                ? { transform: `translate3d(-50%, ${createSheetDragTranslate}%, 0)` }
                : undefined
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="rb-sheet-handle"
              onPointerDown={handleCreateSheetDragStart}
            />
            <button type="button" className="create-sheet-close" onClick={closeCreateSheet}>
              Kapat
            </button>
            <RFQCreate />
          </div>
        </div>
      ) : null}
      <CategorySelector
        mode="modal"
        open={isCategoryModalOpen}
        title="Kategoriler"
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={handleCategorySelect}
        onClear={handleClearCategoryFilter}
        selectedCategoryId={filters.category}
      />
      <LocationPermissionModal
        open={showLocationModal}
        denied={locationDenied}
        loading={locationLoading}
        warningMessage={locationWarning}
        cityOptions={cityOptions}
        selectedCity={filters.city || ''}
        onSelectCity={(city) => {
          setSelectedCity(null);
          setSelectedDistrict(null);
          setFilters((prev) => ({
            ...prev,
            city: city || null,
            cityId: null,
            district: null,
            districtId: null
          }));
          if (city) {
            setShowLocationModal(false);
          }
        }}
        onEnableLocation={resolveLocationPermission}
        onClose={() => setShowLocationModal(false)}
      />
    </div>
  );
}

export default RFQList;
