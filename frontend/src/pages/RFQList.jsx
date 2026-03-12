import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
import { haversineKm, reverseGeocode } from '../utils/geo';
import { FavoriteIcon } from '../components/ui/AppIcons';

const RFQListMap = lazy(() => import('../components/RFQListMap'));
const prefetchRFQListMap = () => import('../components/RFQListMap');

const PAGE_LIMIT = 10;
const RFQ_CACHE_KEY = 'rfq_list_cache_v1';
const SEARCH_HISTORY_KEY = 'rfq_search_history_v1';
const DEFAULT_RADIUS_KM = 30;
const MAX_RADIUS_KM = 80;

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
  const locationAutoApplyRef = useRef(false);
  const createSheetDragStartYRef = useRef(0);
  const createSheetDragStartTranslateRef = useRef(0);
  const createSheetDragTranslateRef = useRef(0);
  const createSheetRafRef = useRef(0);
  const createSheetRef = useRef(null);
  const createSheetSnapRef = useRef({ full: 0, half: 0, closed: 0 });
  const searchInputRef = useRef(null);
  const mapFilterRef = useRef(null);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(() => localStorage.getItem('rfq_sortKey') || 'date_desc');
  const [isCreateSheetMounted, setIsCreateSheetMounted] = useState(false);
  const [createSheetState, setCreateSheetState] = useState('closed');
  const [isCreateSheetDragging, setIsCreateSheetDragging] = useState(false);
  const [createSheetRenderTranslate, setCreateSheetRenderTranslate] = useState(0);
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
  const [useCurrentLocationLoading, setUseCurrentLocationLoading] = useState(false);
  const [cityCenterCoords, setCityCenterCoords] = useState(null);
  const [showResultsToast, setShowResultsToast] = useState(false);
  const [resultsToastVisible, setResultsToastVisible] = useState(false);
  const [mapRadiusKm, setMapRadiusKm] = useState(() => Number(filters.radius) || DEFAULT_RADIUS_KM);
  const [isMapFilterOpen, setIsMapFilterOpen] = useState(false);
  const [isSearchTriggerOpen, setIsSearchTriggerOpen] = useState(false);
  const searchAreaRef = useRef(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredFilters = useDeferredValue(filters);
  const isFiltering = deferredFilters !== filters;

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
    if (!isSearchTriggerOpen) {
      searchInputRef.current?.blur();
      return;
    }
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    });
  }, [isSearchTriggerOpen]);

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
        radiusKm: String(filters.radius)
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

    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status?.state === 'denied') {
          setLocationDenied(true);
          setLocationWarning('Konum izni kapali. Tarayici ayarlarindan izin verip tekrar deneyin.');
          setShowLocationModal(true);
          return false;
        }
      } catch (_error) {
        // ignore permission query errors
      }
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
      prefetchRFQListMap();
    }
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
    if (!socket) {
      return;
    }
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

  const handleRadiusChange = useCallback((value) => {
    const next = Math.min(Math.max(Number(value) || DEFAULT_RADIUS_KM, 5), MAX_RADIUS_KM);
    updateFilter('radius', next);
    setDraftFilters((prev) => (prev ? { ...prev, radius: next } : prev));
  }, [DEFAULT_RADIUS_KM, MAX_RADIUS_KM, updateFilter]);

  useEffect(() => {
    if (liveStatus === 'active' || liveStatus === 'requesting') {
      const currentRadius = Number(filters.radius) || 0;
      if (currentRadius <= 0) {
        updateFilter('radius', DEFAULT_RADIUS_KM);
      }
    }
  }, [DEFAULT_RADIUS_KM, filters.radius, liveStatus, updateFilter]);

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

  useEffect(() => {
    if (!locationAutoApplyRef.current) {
      return;
    }
    if (!draftFilters?.city && !draftFilters?.cityId) {
      return;
    }
    locationAutoApplyRef.current = false;
    handleApplyFilters();
  }, [draftFilters, handleApplyFilters]);

  const updateDraftFilter = useCallback((key, value) => {
    setDraftFilters((prev) => ({
      ...(prev || filters),
      [key]: value
    }));
  }, [filters]);

  const mapRadiusInputRef = useRef(null);

  const handleIncreaseKm = useCallback(() => {
    setViewMode('map');
    window.setTimeout(() => {
      mapRadiusInputRef.current?.focus();
    }, 200);
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

  const openManualSelection = useCallback(() => {
    setShowLocationModal(false);
    handleSelectCity();
  }, [handleSelectCity]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (useCurrentLocationLoading) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationWarning('Konum servisi desteklenmiyor.');
      setToast('Konum alinamadi. Lutfen manuel secin.');
      openManualSelection();
      return;
    }

    setUseCurrentLocationLoading(true);
    setLocationWarning('');

    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status?.state === 'denied') {
          setLocationDenied(true);
          setLocationWarning('Konum izni kapali. Tarayici ayarlarindan izin verip tekrar deneyin.');
          setShowLocationModal(true);
          setUseCurrentLocationLoading(false);
          return;
        }
      } catch (_error) {
        // ignore permission query errors
      }
    }

    const getPosition = () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      });
    });

    try {
      const position = await getPosition();
      const lat = position?.coords?.latitude;
      const lng = position?.coords?.longitude;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Konum bilgisi alinamadi.');
      }

      const coords = { lat, lng };
      setUserCoords(coords);
      setUserPosition(coords);
      setCityCenterCoords(null);

      const latStr = Number(lat).toFixed(6);
      const lngStr = Number(lng).toFixed(6);

      const reverseTry = async () => {
        try {
          const response = await reverseGeocode({ lat, lng });
          const payload = response.data || {};
          if (payload?.success === false) {
            return { status: 'not_found', message: payload?.message || 'not_found' };
          }
          const cityPayload = payload.city || {};
          const districtPayload = payload.district || {};
          const resolveName = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            return value.name || value.label || value.title || '';
          };
          const cityNameCandidates = [
            resolveName(cityPayload),
            resolveName(payload.province),
            resolveName(payload.state),
            resolveName(payload.region),
            resolveName(payload.adminArea),
            resolveName(payload.administrativeArea),
            resolveName(payload.county),
            payload.cityName,
            payload.provinceName,
            payload.stateName,
            payload.regionName,
            payload.il,
            payload.sehir
          ].filter(Boolean);
          const cityName = cityNameCandidates[0];
          const districtName = resolveName(districtPayload) || resolveName(payload.districtName) || resolveName(payload.ilce);

          let resolvedCity = null;
          if (cityName) {
            if (cityPayload?._id || cityPayload?.id) {
              resolvedCity = { _id: cityPayload._id || cityPayload.id, name: cityName };
            } else {
              const cityRes = await api.get('/location/search', { params: { q: cityName } });
              const cityItems = Array.isArray(cityRes.data?.data)
                ? cityRes.data.data
                : Array.isArray(cityRes.data?.items)
                  ? cityRes.data.items
                  : Array.isArray(cityRes.data)
                    ? cityRes.data
                    : [];
              const match = cityItems.find((item) => item?.name?.toLowerCase() === cityName.toLowerCase());
              const fallback = match || cityItems[0];
              if (fallback?._id && fallback?.name) {
                resolvedCity = { _id: fallback._id, name: fallback.name };
              }
            }
          }

          let resolvedDistrict = null;
          if (resolvedCity?._id && districtName) {
            if (districtPayload?._id || districtPayload?.id) {
              resolvedDistrict = {
                _id: districtPayload._id || districtPayload.id,
                name: districtName,
                cityId: districtPayload.cityId || resolvedCity._id
              };
            } else {
              const districtRes = await api.get('/location/districts', {
                params: {
                  cityId: resolvedCity._id,
                  q: districtName,
                  page: 1,
                  limit: 200
                }
              });
              const districtItems = (districtRes.data?.data || []).filter((item) => item?._id && item?.name);
              const match = districtItems.find((item) => item.name.toLowerCase() === districtName.toLowerCase());
              const fallback = match || districtItems[0];
              if (fallback?._id && fallback?.name) {
                resolvedDistrict = { _id: fallback._id, name: fallback.name, cityId: resolvedCity._id };
              }
            }
          }

          if (!resolvedCity?.name) {
            return null;
          }

          let center = null;
          const centerCoords = payload?.center?.coordinates;
          if (Array.isArray(centerCoords) && centerCoords.length === 2) {
            center = { lat: Number(centerCoords[1]), lng: Number(centerCoords[0]) };
          }
          return {
            status: 'ok',
            selection: {
              city: resolvedCity,
              district: resolvedDistrict || null,
              radiusKm: Number(payload.radiusKm) || null,
              center
            }
          };
        } catch (_error) {
          const err = _error;
          return { status: 'error', error: err };
        }
      };

      const fallbackNearestCity = async () => {
        try {
          let page = 1;
          let allItems = [];
          let hasMore = true;

          while (hasMore && page <= 10) {
            const response = await api.get('/location/cities', {
              params: { page, limit: 200, includeCoords: true }
            });
            const items = response.data?.items || response.data?.data || [];
            allItems = allItems.concat(items);
            hasMore = Boolean(response.data?.hasMore);
            page += 1;
          }

          let nearest = null;
          let nearestDistance = Number.POSITIVE_INFINITY;
          allItems.forEach((city) => {
            const coords = city?.center?.coordinates || city?.location?.coordinates || null;
            const latVal = Array.isArray(coords) ? Number(coords[1]) : Number(city?.lat);
            const lngVal = Array.isArray(coords) ? Number(coords[0]) : Number(city?.lng);
            if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) {
              return;
            }
            const distance = haversineKm({ lat, lng }, { lat: latVal, lng: lngVal });
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearest = { _id: city._id || city.id || null, name: city.name, center: { lat: latVal, lng: lngVal } };
            }
          });

          if (!nearest?.name) {
            return null;
          }
          return { city: nearest, district: null, center: nearest.center };
        } catch (_error) {
          return null;
        }
      };

      const reverseResult = await reverseTry();
      let selection = null;
      if (reverseResult?.status === 'ok') {
        selection = reverseResult.selection;
      } else {
        selection = await fallbackNearestCity();
      }

      if (!selection?.city?.name && reverseResult?.status === 'not_found') {
        setLocationWarning('Konumdan sehir bulunamadi. Lutfen manuel secin.');
        setToast('Konumdan sehir bulunamadi. Lutfen manuel secin.');
        openManualSelection();
        return;
      }
      if (!selection?.city?.name) {
        setLocationWarning('Sehir bilgisi bulunamadi. Lutfen manuel secin.');
        setToast('Sehir bilgisi bulunamadi. Lutfen manuel secin.');
        openManualSelection();
        return;
      }

      const resolvedCity = selection.city;
      const resolvedDistrict = selection.district;
      const resolvedCenter = selection.center || null;

      setSelectedCity(resolvedCity);
      if (resolvedDistrict) {
        setSelectedDistrict(resolvedDistrict);
      } else {
        setSelectedDistrict(null);
      }
      setLocationSelection({
        city: resolvedCity,
        district: resolvedDistrict || null
      });
      setCityCenterCoords(resolvedCenter || coords);

      const nextRadiusKm = Math.max(
        Number(selection.radiusKm) || Number(filters.radius) || DEFAULT_RADIUS_KM,
        DEFAULT_RADIUS_KM
      );

      const nextDraft = {
        ...(draftFilters || filters),
        city: resolvedCity.name,
        cityId: resolvedCity._id,
        district: resolvedDistrict?.name || null,
        districtId: resolvedDistrict?._id || null,
        radius: Math.min(nextRadiusKm, MAX_RADIUS_KM)
      };
      setDraftFilters(nextDraft);
      locationAutoApplyRef.current = true;
      setToast('Konumdan sehir secildi.');
      window.setTimeout(() => setToast(null), 1800);
    } catch (error) {
      const status = error?.response?.status;
      let message = error?.response?.data?.message || error?.message || 'Konum alinamadi. Lutfen izin verin.';
      if (error?.code === 1 || error?.name === 'PermissionDeniedError') {
        message = 'Konum izni kapali. Tarayici ayarlarindan izin verip tekrar deneyin.';
        setLocationDenied(true);
        setShowLocationModal(true);
      } else if (error?.code === 2 || error?.code === 3) {
        message = 'Konum alinamadi. Lutfen manuel secin.';
        openManualSelection();
      } else if (status === 404) {
        message = 'Konumdan sehir bulunamadi. Lutfen manuel secin.';
        openManualSelection();
      }
      setLocationWarning(message);
      setToast(message);
      window.setTimeout(() => setToast(null), 2000);
    } finally {
      setUseCurrentLocationLoading(false);
    }
  }, [
    DEFAULT_RADIUS_KM,
    MAX_RADIUS_KM,
    draftFilters,
    filters,
    setSelectedCity,
    setSelectedDistrict,
    setToast,
    setCityCenterCoords,
    setUserCoords,
    setUserPosition,
    useCurrentLocationLoading,
    openManualSelection
  ]);

  function getCreateSheetSnapPoints() {
    const vh = window.innerHeight || 0;
    const sheetHeight =
      createSheetRef.current?.getBoundingClientRect().height || Math.round(vh * 0.85);
    const halfVisible = Math.min(Math.max(vh * 0.75, 560), 760);
    const full = 0;
    const half = Math.max(sheetHeight - halfVisible, 0);
    const closed = Math.max(sheetHeight - 80, half);
    createSheetSnapRef.current = { full, half, closed };
    return createSheetSnapRef.current;
  }

  const applyCreateSheetTranslate = useCallback((value) => {
    createSheetDragTranslateRef.current = value;
    if (createSheetRef.current) {
      createSheetRef.current.style.transform = `translate3d(-50%, ${value}px, 0)`;
    }
  }, []);

  function setCreateSheetTranslate(value, { syncState = false } = {}) {
    createSheetDragTranslateRef.current = value;
    if (syncState) {
      setCreateSheetRenderTranslate(value);
    }
    applyCreateSheetTranslate(value);
  }

  const openCreateSheet = useCallback(() => {
    if (createSheetCloseTimerRef.current) {
      window.clearTimeout(createSheetCloseTimerRef.current);
      createSheetCloseTimerRef.current = null;
    }
    setIsCreateSheetMounted(true);
    window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    window.requestAnimationFrame(() => {
      setCreateSheetState('open-half');
      const snap = getCreateSheetSnapPoints();
      setCreateSheetTranslate(snap.half, { syncState: true });
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
    const snap = getCreateSheetSnapPoints();
    setCreateSheetTranslate(snap.closed, { syncState: true });
    window.dispatchEvent(new CustomEvent('bottomnav:show'));
    createSheetCloseTimerRef.current = window.setTimeout(() => {
      setIsCreateSheetMounted(false);
    }, 350);
  }, [getCreateSheetSnapPoints]);

  useEffect(() => {
    if (isCreateSheetMounted) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isCreateSheetMounted]);

  const handleCreateSheetDragMove = useCallback(
    (event) => {
      if (!isCreateSheetDragging) {
        return;
      }
      const clientY = event.clientY;
      if (typeof clientY !== 'number') {
        return;
      }
      const deltaY = clientY - createSheetDragStartYRef.current;
      const snap = getCreateSheetSnapPoints();
      const minY = snap.full;
      const maxY = snap.closed;
      const next = Math.min(maxY, Math.max(minY, createSheetDragStartTranslateRef.current + deltaY));
      if (createSheetRafRef.current) {
        cancelAnimationFrame(createSheetRafRef.current);
      }
      createSheetRafRef.current = requestAnimationFrame(() => {
        applyCreateSheetTranslate(next);
      });
    },
    [applyCreateSheetTranslate, getCreateSheetSnapPoints, isCreateSheetDragging]
  );

  const handleCreateSheetDragEnd = useCallback(
    () => {
      if (!isCreateSheetDragging) {
        return;
      }
      setIsCreateSheetDragging(false);
      const snap = getCreateSheetSnapPoints();
      const current = createSheetDragTranslateRef.current;
      const candidates = [
        { key: 'open-full', value: snap.full },
        { key: 'open-half', value: snap.half },
        { key: 'closed', value: snap.closed }
      ];
      let nearest = candidates[0];
      let minDistance = Math.abs(current - candidates[0].value);
      candidates.forEach((candidate) => {
        const dist = Math.abs(current - candidate.value);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = candidate;
        }
      });
      if (createSheetRef.current) {
        createSheetRef.current.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      }
      window.removeEventListener('pointermove', handleCreateSheetDragMove);
      window.removeEventListener('pointerup', handleCreateSheetDragEnd);
      if (nearest.key === 'closed') {
        closeCreateSheet();
        return;
      }
      setCreateSheetState(nearest.key);
      setCreateSheetTranslate(nearest.value, { syncState: true });
    },
    [closeCreateSheet, getCreateSheetSnapPoints, handleCreateSheetDragMove, isCreateSheetDragging, setCreateSheetTranslate]
  );

  const handleCreateSheetDragStart = useCallback(
    (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const clientY = event.clientY;
      if (typeof clientY !== 'number') {
        return;
      }
      createSheetDragStartYRef.current = clientY;
      createSheetDragStartTranslateRef.current = createSheetDragTranslateRef.current;
      setIsCreateSheetDragging(true);
      if (createSheetRef.current) {
        createSheetRef.current.style.transition = 'none';
      }
      window.addEventListener('pointermove', handleCreateSheetDragMove, { passive: true });
      window.addEventListener('pointerup', handleCreateSheetDragEnd, { passive: true });
    },
    [handleCreateSheetDragEnd, handleCreateSheetDragMove]
  );

  useEffect(() => {
    if (isCreateSheetDragging) {
      document.body.classList.add('sheet-dragging');
    } else {
      document.body.classList.remove('sheet-dragging');
    }
  }, [isCreateSheetDragging]);

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

  const categoryIndex = useMemo(() => {
    const map = new Map();
    flatSubcategories.forEach((item) => {
      if (!item) return;
      const id = item._id ? String(item._id) : '';
      if (id) map.set(id, item);
      if (item.slug) map.set(String(item.slug), item);
      if (item.name) map.set(String(item.name).toLowerCase(), item);
    });
    return map;
  }, [flatSubcategories]);

  const resolveCategoryItem = useCallback(
    (categoryValue) => {
      if (!categoryValue) {
        return null;
      }
      if (typeof categoryValue === 'object') {
        const rawId = categoryValue._id || categoryValue.id || categoryValue.slug || categoryValue.name || '';
        const key = rawId ? String(rawId) : '';
        return (key && categoryIndex.get(key)) || (key && categoryIndex.get(key.toLowerCase())) || null;
      }
      if (typeof categoryValue === 'string') {
        return categoryIndex.get(categoryValue) || categoryIndex.get(categoryValue.toLowerCase()) || null;
      }
      return null;
    },
    [categoryIndex]
  );

  const getCategoryDisplayName = useCallback(
    (categoryValue) => {
      if (!categoryValue) {
        return '';
      }
      if (typeof categoryValue === 'object') {
        const direct = categoryValue.name || categoryValue.title;
        if (direct) {
          return direct;
        }
      }
      const resolved = resolveCategoryItem(categoryValue);
      if (resolved) {
        if (resolved.parentName && resolved.name && resolved.parentName !== resolved.name) {
          return `${resolved.parentName} > ${resolved.name}`;
        }
        return resolved.name || '';
      }
      return typeof categoryValue === 'string' ? categoryValue : '';
    },
    [resolveCategoryItem]
  );

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
    const value = String(getCategoryDisplayName(category) || '').toLowerCase();
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
  }, [getCategoryDisplayName]);

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

  const radiusCenter = useMemo(
    () => liveLocation || userCoords || cityCenterCoords || null,
    [cityCenterCoords, liveLocation, userCoords]
  );

  const enrichedRFQs = useMemo(() => {
    return rfqs.map((rfq) => {
      const isPremium = isPremiumRFQ(rfq);
      const rfqCoords = getRFQCoords(rfq);
      const distanceKm =
        typeof rfq?.distance === 'number'
          ? rfq.distance / 1000
          : radiusCenter && rfqCoords
            ? distanceInKm(radiusCenter.lat, radiusCenter.lng, Number(rfqCoords.lat), Number(rfqCoords.lng))
            : null;
      const radiusLimit = Number(deferredFilters.radius) || DEFAULT_RADIUS_KM;
      const isCityWide = radiusLimit >= MAX_RADIUS_KM && Boolean(deferredFilters.city || selectedCity?.name);
      const isNearby = typeof distanceKm === 'number' ? (isCityWide ? true : distanceKm <= radiusLimit) : false;

      return {
        ...rfq,
        isPremium,
        distanceKm,
        isNearby
      };
    });
  }, [DEFAULT_RADIUS_KM, MAX_RADIUS_KM, deferredFilters.city, deferredFilters.radius, distanceInKm, getRFQCoords, isPremiumRFQ, radiusCenter, rfqs, selectedCity?.name]);

  const filteredEnrichedRFQs = useMemo(() => {
    return enrichedRFQs.filter((item) => {
      const cityMatch = deferredFilters.city
        ? String(getCityName(item)).toLowerCase() === String(deferredFilters.city).toLowerCase()
        : true;
      const districtMatch = deferredFilters.district
        ? String(getDistrictName(item)).toLowerCase() === String(deferredFilters.district).toLowerCase()
        : true;
      const categoryMatch = deferredFilters.category ? getCategoryKey(item) === String(deferredFilters.category) : true;
      const radiusLimit = Number(deferredFilters.radius) || DEFAULT_RADIUS_KM;
      const isCityWide = radiusLimit >= MAX_RADIUS_KM && Boolean(deferredFilters.city || selectedCity?.name);
      const radiusMatch = radiusCenter
        ? typeof item.distanceKm === 'number'
          ? (isCityWide ? true : item.distanceKm <= radiusLimit)
          : true
        : true;
      return cityMatch && districtMatch && categoryMatch && radiusMatch;
    });
  }, [DEFAULT_RADIUS_KM, MAX_RADIUS_KM, deferredFilters.category, deferredFilters.city, deferredFilters.district, deferredFilters.radius, enrichedRFQs, getCategoryKey, getCityName, getDistrictName, radiusCenter, selectedCity?.name]);

  const filteredNearbyRFQs = useMemo(() => {
    return nearbyRFQs.filter((item) => {
      const cityMatch = deferredFilters.city
        ? String(getCityName(item)).toLowerCase() === String(deferredFilters.city).toLowerCase()
        : true;
      const districtMatch = deferredFilters.district
        ? String(getDistrictName(item)).toLowerCase() === String(deferredFilters.district).toLowerCase()
        : true;
      const categoryMatch = deferredFilters.category ? getCategoryKey(item) === String(deferredFilters.category) : true;
      const radiusLimit = Number(deferredFilters.radius) || DEFAULT_RADIUS_KM;
      const isCityWide = radiusLimit >= MAX_RADIUS_KM && Boolean(deferredFilters.city || selectedCity?.name);
      const radiusMatch = radiusCenter
        ? (() => {
            const coords = getRFQCoords(item);
            if (!coords) return true;
            const dist = distanceInKm(radiusCenter.lat, radiusCenter.lng, Number(coords.lat), Number(coords.lng));
            return Number.isFinite(dist) ? (isCityWide ? true : dist <= radiusLimit) : true;
          })()
        : true;
      return cityMatch && districtMatch && categoryMatch && radiusMatch;
    });
  }, [
    DEFAULT_RADIUS_KM,
    MAX_RADIUS_KM,
    deferredFilters.category,
    deferredFilters.city,
    deferredFilters.district,
    deferredFilters.radius,
    distanceInKm,
    getCategoryKey,
    getCityName,
    getDistrictName,
    getRFQCoords,
    nearbyRFQs,
    radiusCenter,
    selectedCity?.name
  ]);

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
  const selectedCityLabel = useMemo(
    () => deferredFilters.city || selectedCity?.name || 'Seçili Şehir',
    [deferredFilters.city, selectedCity?.name]
  );
  const mapRadiusCenter = radiusCenter;
  const hasRadiusCenter = Boolean(mapRadiusCenter && Number.isFinite(mapRadiusCenter.lat) && Number.isFinite(mapRadiusCenter.lng));
  const isMapCityWide = mapRadiusKm >= MAX_RADIUS_KM && Boolean(filters.city || selectedCity?.name);
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
    if (!hasRadiusCenter || mapRadiusKm <= 0 || isMapCityWide) {
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
  }, [getRFQCoords, hasRadiusCenter, isMapCityWide, mapRadiusCenter, mapRadiusKm, quickFilteredRFQs]);

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
    if (hasRadiusCenter && mapRadiusKm > 0 && !isMapCityWide) {
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
  }, [getRFQCoords, hasRadiusCenter, isMapCityWide, mapAreaFilterActive, mapAreaFilterIds, mapBaseItems, mapBounds, mapRadiusCenter, mapRadiusKm]);

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

  const mapViewActive = viewMode === 'map' &&
    !isFilterSheetOpen &&
    !isCategoryModalOpen &&
    !isCreateSheetMounted &&
    !showLocationModal;

  useEffect(() => {
    if (mapViewActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mapViewActive]);

  useEffect(() => {
    if (!mapViewActive) {
      setIsMapFilterOpen(false);
    }
  }, [mapViewActive]);

  const listIsEmpty = radiusFilteredRFQs.length === 0;
  const mapIsEmpty = mapItems.length === 0;
  const hasCityFilter = Boolean(filters.city || selectedCity?.name);
  const selectedKm = Number(filters.radius) || DEFAULT_RADIUS_KM;
  const canApplyFilters = Boolean((draftFilters || filters).city || (draftFilters || filters).cityId);
  const hasMapCoords = mapBaseItems.length > 0;

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
    const nextRadius = Number(filters.radius) || DEFAULT_RADIUS_KM;
    const timer = window.setTimeout(() => {
      setMapRadiusKm(nextRadius);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [DEFAULT_RADIUS_KM, filters.radius]);

  useEffect(() => {
    if (!isSearchTriggerOpen) {
      return undefined;
    }
    const handleOutside = (event) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target)) {
        if (!searchQuery) {
          setIsSearchTriggerOpen(false);
        }
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, [isSearchTriggerOpen, pushSearchHistory, searchQuery]);

  useEffect(() => {
    if (!isMapFilterOpen) {
      return undefined;
    }
    const handleOutside = (event) => {
      if (mapFilterRef.current && !mapFilterRef.current.contains(event.target)) {
        setIsMapFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, [isMapFilterOpen]);

  const closeSearchSheet = useCallback(() => {
    pushSearchHistory(searchQuery);
    setIsSearchTriggerOpen(false);
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
    const query = normalizeSearch(deferredSearchQuery);
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
  }, [deferredSearchQuery, flatSubcategories, normalizeSearch]);

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
            <div className="rfq-sub">Kategori: {getCategoryDisplayName(rfq.category) || '-'}</div>
            {rfq.productDetails?.brand || rfq.productDetails?.model ? (
              <div className="rfq-sub">
                {rfq.productDetails?.brand || ''} {rfq.productDetails?.model || ''}
              </div>
            ) : null}
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
      getCategoryDisplayName,
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

      <div className="rfq-search-area" ref={searchAreaRef}>
        <div
          className={`rfq-search-trigger ${isSearchTriggerOpen ? 'is-open' : ''}`}
          role={isSearchTriggerOpen ? 'search' : 'button'}
          tabIndex={isSearchTriggerOpen ? -1 : 0}
          aria-label="Talepleri ara"
          aria-expanded={isSearchTriggerOpen}
          onClick={(event) => {
            if (isSearchTriggerOpen) {
              setIsSearchTriggerOpen(false);
              return;
            }
            setIsMapFilterOpen(false);
            setIsSearchTriggerOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setIsSearchTriggerOpen(false);
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!isSearchTriggerOpen) {
                setIsMapFilterOpen(false);
                setIsSearchTriggerOpen(true);
                return;
              }
              searchInputRef.current?.focus();
            }
          }}
        >
          <span className="rfq-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <line x1="16.2" y1="16.2" x2="20" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          {isSearchTriggerOpen ? null : null}
        </div>
        {isSearchTriggerOpen ? (
          <div className="rfq-search-panel">
            <div className="search-input-wrap">
              <span className="search-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <line x1="16.2" y1="16.2" x2="20" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    pushSearchHistory(searchQuery);
                  }
                }}
                placeholder="Başlık, kategori, açıklama..."
                className="search-input rfq-inline-search-input"
                ref={searchInputRef}
                autoComplete="off"
                inputMode="search"
                enterKeyHint="search"
              />
              <button
                type="button"
                className="rfq-search-cta"
                onClick={() => pushSearchHistory(searchQuery)}
              >
                Ara
              </button>
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
          </div>
        ) : null}
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
            {isFiltering ? (
              <div className="filter-loading">
                <span className="spinner" aria-hidden="true" />
                <span>Filtreleniyor…</span>
              </div>
            ) : null}

            {listIsEmpty && !nearbyLoading ? (
              <EmptyStateCard
                title={hasCityFilter ? 'Bu bölgede talep yok' : 'Şehir seçerek talepleri gör'}
                description={
                  hasCityFilter
                    ? `${deferredFilters.city || selectedCityLabel} • ${selectedKm >= MAX_RADIUS_KM ? 'Şehir geneli' : `${selectedKm} km`} için henüz ilan bulunamadı.`
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

      {!loading && mapViewActive ? (
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
          {mapViewActive && !isSearchTriggerOpen ? (
            <div className={`map-filter-shell ${isMapFilterOpen ? 'is-open' : ''}`} ref={mapFilterRef}>
              <button
                type="button"
                className="map-filter-toggle"
                aria-label="Konum filtresini aç"
                aria-expanded={isMapFilterOpen}
                onClick={() => {
                  setIsSearchTriggerOpen(false);
                  setIsMapFilterOpen((prev) => !prev);
                }}
              >
                <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
                  <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              <div className="map-filter-panel">
                <div className="map-live-controls">
                  <button type="button" className="secondary-btn" onClick={toggleLiveLocation}>
                    {liveStatus === 'active' || liveStatus === 'requesting' ? 'Canli konumu kapat' : 'Canli konumu ac'}
                  </button>
                  {liveStatus === 'active' ? (
                    <span className="map-live-status">
                      Konum aktif{Number.isFinite(Number(accuracy)) ? ` • ±${Math.round(Number(accuracy))}m` : ''}
                    </span>
                  ) : (
                    <span className="map-live-status">
                      {radiusCenter ? 'Konum merkezli filtre aktif' : 'Yaricap filtresi icin konum sec'}
                    </span>
                  )}
                </div>
                <div className="map-radius-controls">
                  <div className="map-radius-header">
                    <span>Yakınındaki ilanlar</span>
                    <strong>{isMapCityWide ? 'Şehir geneli' : `${selectedKm} km`}</strong>
                  </div>
                  <input
                    ref={mapRadiusInputRef}
                    type="range"
                    min="5"
                    max={MAX_RADIUS_KM}
                    step="1"
                    value={Math.min(selectedKm, MAX_RADIUS_KM)}
                    onChange={(event) => handleRadiusChange(event.target.value)}
                    disabled={!radiusCenter}
                    aria-label="Yarıçap filtresi"
                  />
                  <div className="map-radius-hint">
                    {radiusCenter
                      ? isMapCityWide
                        ? 'Maksimum yarıçap: şehirdeki tüm ilanlar'
                        : 'Yarıçapı değiştirerek listeyi daralt'
                      : 'Konum açınca yarıçap filtresi aktif olur'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <Suspense
            fallback={
              <div className="map-overlay map-loading">
                <div className="map-loading-card">
                  <div className="map-loading-spinner" />
                  <div>
                    <div className="map-loading-title">Harita yükleniyor…</div>
                    <div className="map-loading-sub">Veriler hazırlanıyor</div>
                  </div>
                </div>
              </div>
            }
          >
            <RFQListMap
              mapCenter={mapCenter}
              mapItems={mapItems}
              mapTileUrl={mapTileUrl}
              mapAttribution={mapAttribution}
              radiusCenter={mapRadiusCenter}
              mapRadiusKm={mapRadiusKm}
              showRadiusCircle={!isMapCityWide}
              clusterRef={clusterRef}
              mapZoom={mapZoom}
              setMapZoom={setMapZoom}
              setMapBounds={setMapBounds}
              setMapHasMoved={setMapHasMoved}
              shouldSuppressMapUpdates={shouldSuppressMapUpdates}
              getRFQCoords={getRFQCoords}
              getCardImages={getCardImages}
              getCategoryName={getCategoryDisplayName}
              isPremiumRFQ={isPremiumRFQ}
              isFeaturedRFQ={isFeaturedRFQ}
              isActiveRequest={isActiveRequest}
              nowTs={nowTs}
              newRFQMarkers={newRFQMarkers}
              selectedRfq={selectedRfq}
              setSelectedRfq={setSelectedRfq}
              navigate={navigate}
              routePoints={routePoints}
              userPosition={userPosition}
              isDarkMode={isDarkMode}
              mapAreaFilterActive={mapAreaFilterActive}
              escapeHtml={escapeHtml}
            />
          </Suspense>

        </motion.div>
      ) : null}
      </AnimatePresence>

      {!loading && hasMore ? <div ref={loadMoreRef} className="load-more-sentinel" /> : null}
      {refreshing ? <div className="refresh-text">Yenileniyor...</div> : null}
      {showResultsToast && filters.city ? (
        <div className={`results-toast ${resultsToastVisible ? 'show' : ''}`}>
          📍 <strong>{filters.city}</strong> icinde{' '}
          <span className="results-km">
            {selectedKm >= MAX_RADIUS_KM ? 'Şehir geneli' : `${selectedKm} km`}
          </span>{' '}
          capindaki talepler gosteriliyor
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}

      <ReusableBottomSheet
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Şehir Seç"
        initialSnap="mid"
        headerRight={(
          <div className="sheet-header-actions">
            <button
              type="button"
              className={`sheet-location-btn ${useCurrentLocationLoading ? 'is-loading' : ''}`}
              aria-label="Mevcut konumu kullan"
              onClick={handleUseCurrentLocation}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              disabled={useCurrentLocationLoading}
              aria-busy={useCurrentLocationLoading}
            >
              {useCurrentLocationLoading ? (
                <span className="spinner sheet-location-spinner" aria-hidden="true" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2.5c-3.86 0-7 3.14-7 7 0 5.04 6.2 11.9 6.47 12.19.28.31.77.31 1.05 0C12.8 21.4 19 14.54 19 9.5c0-3.86-3.14-7-7-7Zm0 10.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Z"/>
                  <path d="M6 20.3c1.9 1.2 3.9 1.7 6 1.7s4.1-.5 6-1.7c.5-.3.2-1.1-.4-1.1H6.4c-.6 0-.9.8-.4 1.1Z"/>
                </svg>
              )}
            </button>
            {useCurrentLocationLoading ? (
              <span className="sheet-location-loading">Bulunuyor...</span>
            ) : null}
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
          </div>
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
            style={{ transform: `translate3d(-50%, ${createSheetRenderTranslate}px, 0)` }}
            ref={createSheetRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="rb-sheet-handle-wrap"
              onPointerDown={handleCreateSheetDragStart}
              role="button"
              aria-label="Sheet sürükleme"
            >
              <div className="rb-sheet-handle" />
            </div>
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
        onManualSelect={openManualSelection}
        onEnableLocation={resolveLocationPermission}
        onClose={() => setShowLocationModal(false)}
      />
    </div>
  );
}

export default RFQList;
