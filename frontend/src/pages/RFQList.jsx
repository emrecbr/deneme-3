import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import CategorySelector from '../components/CategorySelector';
import EmptyStateCard from '../components/EmptyStateCard';
import ErrorStateCard from '../components/ErrorStateCard';
import FilterBar from '../components/FilterBar';
import HomeHeroBanner from '../components/home/HomeHeroBanner';
import HomeQuickCategories from '../components/home/HomeQuickCategories';
import HomeSectionHeader from '../components/home/HomeSectionHeader';
import RFQDiscoveryCard from '../components/RFQDiscoveryCard';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import RFQSkeletonGrid from '../components/RFQSkeletonGrid';
import LoadingOverlay from '../components/LoadingOverlay';
import useBottomSheetDrag from '../hooks/useBottomSheetDrag';
import RFQCreate from './RFQCreate';
import { useAuth } from '../context/AuthContext';
import { getSocket, normalizeSocketCity } from '../lib/socket';
import { triggerHaptic } from '../utils/haptic';
import { trackAnalyticsEvent } from '../utils/analytics';
import { formatRemainingTime, getRequestStatusLabel, isActiveRequest } from '../utils/rfqStatus';
import { getDistanceKm } from '../utils/distance';
import { extractRfqCityName, extractRfqDistrictName, formatCategoryLabel, formatRfqLocation } from '../utils/rfqFormatters';
import { lockSheetSurface, unlockSheetSurface } from '../utils/sheetLock';
import {
  clearNativeLoginBootstrapPending,
  readNativeLoginBootstrapPending
} from '../utils/nativeLoginBootstrap';
import { isNativeCapacitorRuntime } from '../utils/nativePlatform';

const PAGE_LIMIT = 10;
const RFQ_CACHE_KEY = 'rfq_list_cache_v1';
const SEARCH_HISTORY_KEY = 'rfq_search_history_v1';
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_RADIUS_SETTINGS = {
  min: 5,
  max: 80,
  step: 1,
  default: 30,
  cityFallbackEnabled: true,
  liveLocationEnabled: true
};
const DEFAULT_MAP_SETTINGS = {
  mapViewEnabled: true,
  defaultCenter: { lat: 41.0082, lng: 28.9784 },
  defaultZoom: 11,
  minZoom: 6,
  maxZoom: 18,
  clusterEnabled: true,
  radiusCircleEnabled: true,
  controlsEnabled: true
};
const nativeAuthPerf = (event, extra = {}) => {
  if (!isNativeCapacitorRuntime()) {
    return;
  }
  console.info('NATIVE_AUTH_PERF', {
    event,
    path: window.location.pathname,
    ...extra
  });
};
const DEFAULT_FEATURE_FLAGS = {
  mapViewEnabled: true,
  searchPanelEnabled: true,
  liveLocationEnabled: true,
  cityFallbackEnabled: true
};
const SYNTHETIC_CATEGORY_PREFIX = 'synthetic-category';
const OTHER_CATEGORY_NAME = 'Diğer';
const JOBSEEKER_REQUIRED_CHILD_SLUGS = ['cafe', 'sanayi', 'lokanta', 'diger'];
const SEGMENT_OPTIONS = [
  { value: 'goods', label: 'Eşya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];
const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Fiyata göre: yükselen' },
  { value: 'price_desc', label: 'Fiyata göre: düşen' },
  { value: 'date_desc', label: 'Tarihe göre: yeni ilan' },
  { value: 'date_asc', label: 'Tarihe göre: eski ilan' }
];
const DEFAULT_HOME_QUICK_CATEGORIES = [
  { key: 'default-goods', label: 'Eşya', segment: 'goods', backgroundColor: '#FFF4DE', enabled: true, sortOrder: 10 },
  { key: 'default-service', label: 'Hizmet', segment: 'service', backgroundColor: '#EAF2FF', enabled: true, sortOrder: 20 },
  { key: 'default-auto', label: 'Otomobil', segment: 'auto', backgroundColor: '#EEFDF8', enabled: true, sortOrder: 30 },
  { key: 'default-jobseeker', label: 'İş Arayan', segment: 'jobseeker', backgroundColor: '#F3EFFF', enabled: true, sortOrder: 40 }
];
const DEFAULT_HOME_CONTENT = {
  heroTitle: '',
  heroSubtitle: '',
  layoutVariant: 'premium_mobile_v1',
  heroBanner: {
    enabled: true,
    title: 'Talebini daha hızlı tamamla',
    subtitle: 'Yakındaki açık talepleri keşfet ve doğru tekliflere daha hızlı ulaş.',
    ctaLabel: 'Talep Oluştur',
    ctaPath: '/create',
    imageUrl: '',
    overlayEnabled: true,
    sortOrder: 10
  },
  quickCategories: DEFAULT_HOME_QUICK_CATEGORIES,
  homeSections: [],
  visualTheme: {
    background: '#F5F1EA',
    cardRadius: 28,
    useSoftCards: true
  }
};

const normalizeHomeContent = (payload = {}) => ({
  ...DEFAULT_HOME_CONTENT,
  ...payload,
  heroBanner: { ...DEFAULT_HOME_CONTENT.heroBanner, ...(payload.heroBanner || {}) },
  visualTheme: { ...DEFAULT_HOME_CONTENT.visualTheme, ...(payload.visualTheme || {}) },
  quickCategories:
    Array.isArray(payload.quickCategories) && payload.quickCategories.length
      ? payload.quickCategories
      : DEFAULT_HOME_QUICK_CATEGORIES,
  homeSections: Array.isArray(payload.homeSections) ? payload.homeSections : []
});

const normalizeSortNumber = (value) => {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const normalizeRFQSortPrice = (item) => {
  const candidates = [
    item?.price,
    item?.budget,
    item?.targetPrice,
    item?.minPrice,
    item?.maxPrice,
    item?.offerPrice,
    item?.estimatedPrice,
    item?.amount,
    item?.priceRange?.min,
    item?.priceRange?.max,
    item?.budgetRange?.min,
    item?.budgetRange?.max
  ];
  for (const candidate of candidates) {
    const value = normalizeSortNumber(candidate);
    if (value != null) {
      return value;
    }
  }
  return null;
};

const normalizeRFQSortDate = (item) => {
  const raw = item?.createdAt || item?.created_at || item?.date || null;
  const value = raw ? new Date(raw).getTime() : null;
  return Number.isFinite(value) ? value : null;
};

const normalizePublishingRight = (rfq) => {
  const raw = rfq?.publishingRight || rfq?.publishing_right || rfq?.right || null;
  if (!raw) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return raw.key || raw.type || raw.value || raw.name || '';
};

const getRfqPromotionTier = (rfq) => {
  const right = String(normalizePublishingRight(rfq)).toLowerCase();
  if (rfq?.isPremium === true || rfq?.premium === true || right === 'premium') {
    return 0;
  }
  if (
    rfq?.isFeatured === true ||
    rfq?.featuredActive === true ||
    right === 'featured_listing' ||
    right === 'featured'
  ) {
    return 1;
  }
  return 2;
};

const compareRFQsBySortKey = (a, b, sortKey) => {
  switch (sortKey) {
    case 'price_desc': {
      const aPrice = normalizeRFQSortPrice(a);
      const bPrice = normalizeRFQSortPrice(b);
      if (aPrice == null && bPrice == null) return 0;
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      return bPrice - aPrice;
    }
    case 'price_asc': {
      const aPrice = normalizeRFQSortPrice(a);
      const bPrice = normalizeRFQSortPrice(b);
      if (aPrice == null && bPrice == null) return 0;
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      return aPrice - bPrice;
    }
    case 'date_asc': {
      const aDate = normalizeRFQSortDate(a);
      const bDate = normalizeRFQSortDate(b);
      if (aDate == null && bDate == null) return 0;
      if (aDate == null) return 1;
      if (bDate == null) return -1;
      return aDate - bDate;
    }
    case 'km_asc': {
      const aKm = Number(a?.distanceKm ?? a?.km ?? a?.distance);
      const bKm = Number(b?.distanceKm ?? b?.km ?? b?.distance);
      const safeAKm = Number.isFinite(aKm) ? aKm : Number.POSITIVE_INFINITY;
      const safeBKm = Number.isFinite(bKm) ? bKm : Number.POSITIVE_INFINITY;
      return safeAKm - safeBKm;
    }
    case 'km_desc': {
      const aKm = Number(a?.distanceKm ?? a?.km ?? a?.distance);
      const bKm = Number(b?.distanceKm ?? b?.km ?? b?.distance);
      const safeAKm = Number.isFinite(aKm) ? aKm : Number.NEGATIVE_INFINITY;
      const safeBKm = Number.isFinite(bKm) ? bKm : Number.NEGATIVE_INFINITY;
      return safeBKm - safeAKm;
    }
    case 'date_desc':
    default: {
      const aDate = normalizeRFQSortDate(a);
      const bDate = normalizeRFQSortDate(b);
      if (aDate == null && bDate == null) return 0;
      if (aDate == null) return 1;
      if (bDate == null) return -1;
      return bDate - aDate;
    }
  }
};

function buildCategoryTree(items) {
  const map = new Map();
  const roots = [];

  items.forEach((cat) => {
    map.set(String(cat._id), { ...cat, children: [] });
  });

  items.forEach((cat) => {
    const parentId = cat.parent ? String(typeof cat.parent === 'object' ? cat.parent._id : cat.parent) : null;
    const node = map.get(String(cat._id));
    if (!node) return;

    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function normalizeCategoryTree(nodes, inheritedSegment = '') {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((node) => ({
    ...node,
    segment: node.segment || inheritedSegment || '',
    children: normalizeCategoryTree(node.children || [], node.segment || inheritedSegment || '')
  }));
}

function flattenCategoryLeaves(nodes, parentTrail = []) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    const nextTrail = [...parentTrail, node];
    if (!node.children?.length) {
      return [{
        ...node,
        parentId: parentTrail[parentTrail.length - 1]?._id || null,
        parentName: parentTrail[parentTrail.length - 1]?.name || ''
      }];
    }
    return flattenCategoryLeaves(node.children, nextTrail);
  });
}

const normalizeCategoryName = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

const buildSyntheticCategoryId = (node, slug = 'diger') => {
  const segment = String(node?.segment || '').trim();
  const parentSlug = String(node?.slug || node?._id || node?.name || '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  if (!segment || !parentSlug) {
    return '';
  }
  return `${SYNTHETIC_CATEGORY_PREFIX}:${segment}:${parentSlug}:${slug}`;
};

const getSyntheticCategoryFamilyIds = (node) => {
  const ids = [];
  const hasChildren = Boolean(node?.children?.length);
  if (hasChildren && normalizeCategoryName(node?.name) !== normalizeCategoryName(OTHER_CATEGORY_NAME)) {
    const otherId = buildSyntheticCategoryId(node, 'diger');
    if (otherId) {
      ids.push(otherId);
    }
  }

  if (node?.segment === 'jobseeker' && (!node?.parent || Number(node?.level || 0) === 0)) {
    JOBSEEKER_REQUIRED_CHILD_SLUGS.forEach((slug) => {
      const id = buildSyntheticCategoryId(node, slug);
      if (id) {
        ids.push(id);
      }
    });
  }

  return ids;
};

function flattenCategoryNodes(nodes, parentTrail = []) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    const nextTrail = [...parentTrail, node];
    const children = flattenCategoryNodes(node.children || [], nextTrail);
    const ownId = node._id ? String(node._id) : '';
    const syntheticIds = getSyntheticCategoryFamilyIds(node);
    return [
      {
        ...node,
        parentId: parentTrail[parentTrail.length - 1]?._id || null,
        parentName: parentTrail[parentTrail.length - 1]?.name || '',
        path: nextTrail.map((item) => item.name).filter(Boolean),
        descendantIds: children.map((item) => String(item._id || '')).filter(Boolean),
        categoryFamilyIds: [
          ownId,
          ...children.map((item) => String(item._id || '')),
          ...children.flatMap((item) => item.categoryFamilyIds || []),
          ...syntheticIds
        ].filter(Boolean)
      },
      ...children
    ];
  });
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

function getRFQIdentity(item) {
  return String(item?._id || item?.id || '');
}

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function RFQList({ surfaceVariant = 'app' }) {
  const BACKEND_ORIGIN = API_BASE_URL.replace('/api', '');
  const isWebSurface = surfaceVariant === 'web';
  const { selectedCity, setSelectedCity, selectedDistrict, setSelectedDistrict } = useAuth();
  const navigate = useNavigate();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const nativeBootstrapHandledRef = useRef(0);
  const nativeBootstrapInFlightRef = useRef(false);
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
  const createSheetLockKeyRef = useRef(`rfq-create-sheet-${Math.random().toString(36).slice(2)}`);
  const locationAutoApplyRef = useRef(false);
  const createSheetDragTranslateRef = useRef(0);
  const createSheetRef = useRef(null);
  const createSheetSnapRef = useRef({ full: 0, half: 0, closed: 0 });
  const searchInputRef = useRef(null);
  const mapFilterRef = useRef(null);
  const sortMenuRef = useRef(null);
  const overlayTimerRef = useRef(null);
  const feedViewKeyRef = useRef('');
  const feedScrollMarksRef = useRef(new Set());
  const feedScrollRafRef = useRef(null);
  const cardImpressionObserverRef = useRef(null);
  const cardImpressionSeenRef = useRef(new Set());

  const [rfqs, setRfqs] = useState([]);
  const [nearbyRFQs, setNearbyRFQs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const hasLoadedOnceRef = useRef(false);
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
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(() => localStorage.getItem('rfq_sortKey') || 'date_desc');
  const [isCreateSheetMounted, setIsCreateSheetMounted] = useState(false);
  const [createSheetState, setCreateSheetState] = useState('closed');
  const [createSheetRenderTranslate, setCreateSheetRenderTranslate] = useState(0);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categoryItems, setCategoryItems] = useState([]);
  const [inlineSubcategories, setInlineSubcategories] = useState([]);
  const [flatSubcategories, setFlatSubcategories] = useState([]);
  const [filterCompact, setFilterCompact] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [newRFQMarkers, setNewRFQMarkers] = useState({});
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_SETTINGS.defaultZoom);
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
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [radiusConfig, setRadiusConfig] = useState(DEFAULT_RADIUS_SETTINGS);
  const [mapSettings, setMapSettings] = useState(DEFAULT_MAP_SETTINGS);
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [filters, setFilters] = useState({
    radius: DEFAULT_RADIUS_SETTINGS.default,
    segment: null,
    cityId: null,
    districtId: null,
    category: null,
    city: null,
    district: null,
    sort: 'date_desc',
    status: null
  });
  const [draftFilters, setDraftFilters] = useState(null);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const [cityPickerQuery, setCityPickerQuery] = useState('');
  const [cityPickerOptions, setCityPickerOptions] = useState([]);
  const [cityPickerLoading, setCityPickerLoading] = useState(false);
  const [cityPickerError, setCityPickerError] = useState('');
  const selectedRfqId = getRFQIdentity(selectedRfq);
  const [locationSelection, setLocationSelection] = useState(null);
  const [cityCenterCoords, setCityCenterCoords] = useState(null);
  const [showResultsToast, setShowResultsToast] = useState(false);
  const [resultsToastVisible, setResultsToastVisible] = useState(false);
  const [mapRadiusKm, setMapRadiusKm] = useState(() => Number(filters.radius) || DEFAULT_RADIUS_SETTINGS.default);
  const [isMapFilterOpen, setIsMapFilterOpen] = useState(false);
  const [isSearchTriggerOpen, setIsSearchTriggerOpen] = useState(false);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const searchAreaRef = useRef(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredFilters = useDeferredValue(filters);
  const isFiltering = deferredFilters !== filters;
  const appliedFilters = useMemo(
    () => ({
      ...deferredFilters,
      city: deferredFilters.city || selectedCity?.name || null,
      cityId: deferredFilters.cityId || selectedCity?._id || null,
      district: deferredFilters.district || selectedDistrict?.name || null,
      districtId: deferredFilters.districtId || selectedDistrict?._id || null
    }),
    [
      deferredFilters,
      selectedCity?._id,
      selectedCity?.name,
      selectedDistrict?._id,
      selectedDistrict?.name
    ]
  );
  const minRadiusKm = Number.isFinite(Number(radiusConfig.min)) ? Number(radiusConfig.min) : DEFAULT_RADIUS_SETTINGS.min;
  const maxRadiusKm = Number.isFinite(Number(radiusConfig.max)) ? Number(radiusConfig.max) : DEFAULT_RADIUS_SETTINGS.max;
  const radiusStep = Number.isFinite(Number(radiusConfig.step)) ? Number(radiusConfig.step) : DEFAULT_RADIUS_SETTINGS.step;
  const mapViewEnabled = featureFlags.mapViewEnabled !== false && mapSettings.mapViewEnabled !== false;
  const searchPanelEnabled = featureFlags.searchPanelEnabled !== false;
  const cityFallbackEnabled =
    radiusConfig.cityFallbackEnabled !== false && featureFlags.cityFallbackEnabled !== false;

  useEffect(() => {
    const isInitialLoad = loading && !hasLoadedOnceRef.current;
    const shouldShow = loading && !loadingMore && !nearbyLoading && (isInitialLoad || isFiltering);

    if (shouldShow) {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = setTimeout(() => {
        setShowLoadingOverlay(true);
      }, 200);
    } else {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      setShowLoadingOverlay(false);
      if (!loading) {
        hasLoadedOnceRef.current = true;
      }
    }

    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [isFiltering, loading, loadingMore, nearbyLoading]);

  const currentUserId = useMemo(() => currentUser?.id || currentUser?._id || null, [currentUser]);
  const activeCity = useMemo(() => normalizeSocketCity(filters.city || currentUser?.city), [currentUser?.city, filters.city]);
  const isDarkMode = document.body.classList.contains('dark-mode');
  const showActiveOnly = Boolean(filters.status === 'active' || filters.activeOnly);
  const shouldSuppressMapUpdates = Boolean(selectedRfq?._id);
  const appliedCityKey = String(appliedFilters.city || '').trim().toLowerCase();
  const appliedDistrictKey = String(appliedFilters.district || '').trim().toLowerCase();
  const selectionCityKey = String(locationSelection?.city?.name || '').trim().toLowerCase();
  const selectionDistrictKey = String(locationSelection?.district?.name || '').trim().toLowerCase();
  const currentLocationMatchesFilters = useMemo(() => {
    if (!userCoords) {
      return false;
    }
    if (!appliedCityKey) {
      return true;
    }
    if (!selectionCityKey || selectionCityKey !== appliedCityKey) {
      return false;
    }
    if (!appliedDistrictKey) {
      return true;
    }
    return Boolean(selectionDistrictKey) && selectionDistrictKey === appliedDistrictKey;
  }, [appliedCityKey, appliedDistrictKey, selectionCityKey, selectionDistrictKey, userCoords]);
  useEffect(() => {
    let active = true;
    const loadRadiusSettings = async () => {
      try {
        const response = await api.get('/location/radius-settings');
        const nextConfig = response.data?.data;
        if (!active || !nextConfig) return;
        setRadiusConfig((prev) => ({ ...prev, ...nextConfig }));
        setFilters((prev) => {
          const nextDefault = Number(nextConfig.default);
          if (!Number.isFinite(nextDefault)) return prev;
          if (prev.radius === DEFAULT_RADIUS_SETTINGS.default) {
            return { ...prev, radius: nextDefault };
          }
          return prev;
        });
      } catch (_error) {
        // ignore settings fetch errors
      }
    };
    loadRadiusSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMapSettings = async () => {
      try {
        const response = await api.get('/map/settings');
        const next = response.data?.data;
        if (!active || !next) return;
        setMapSettings((prev) => ({ ...prev, ...next }));
        setMapZoom((prev) => (prev === DEFAULT_MAP_SETTINGS.defaultZoom ? Number(next.defaultZoom || prev) : prev));
      } catch (_error) {
        // ignore map settings errors
      }
    };
    loadMapSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSuggestions = async () => {
      try {
        const response = await api.get('/search/suggestions');
        if (!active) return;
        setSearchSuggestions(response.data?.items || []);
      } catch (_error) {
        if (active) setSearchSuggestions([]);
      }
    };
    loadSuggestions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadFeatureFlags = async () => {
      try {
        const response = await api.get('/system/feature-flags');
        if (!active) return;
        const nextFlags = response.data?.data;
        if (nextFlags) {
          setFeatureFlags((prev) => ({ ...prev, ...nextFlags }));
        }
      } catch (_error) {
        // ignore feature flags fetch errors
      }
    };
    loadFeatureFlags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!searchPanelEnabled && isSearchTriggerOpen) {
      setIsSearchTriggerOpen(false);
    }
  }, [isSearchTriggerOpen, searchPanelEnabled]);

  useEffect(() => {
    setFilters((prev) => {
      const current = Number(prev.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
      const clamped = Math.min(Math.max(current, minRadiusKm), maxRadiusKm);
      if (clamped === current) return prev;
      return { ...prev, radius: clamped };
    });
    setMapRadiusKm((prev) => Math.min(Math.max(prev, minRadiusKm), maxRadiusKm));
  }, [maxRadiusKm, minRadiusKm, radiusConfig.default]);
  const getRFQCoords = useCallback((rfq) => {
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
  }, []);
  const getCityName = useCallback((item) => extractRfqCityName(item), []);
  const getDistrictName = useCallback((item) => extractRfqDistrictName(item), []);
  const isPremiumRFQ = useCallback(
    (rfq) => getRfqPromotionTier(rfq) === 0,
    []
  );
  const isFeaturedRFQ = useCallback((rfq) => getRfqPromotionTier(rfq) === 1, []);

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
            segment: filters.segment || undefined,
            category: filters.category || undefined,
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
          setError('Canlı veri alınamadı. Son önbellek gösteriliyor.');
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
    [cacheRFQs, filters.category, filters.cityId, filters.districtId, filters.segment, handleAuthFailure, readCachedRFQs]
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

  useEffect(() => {
    if (!isCityPickerOpen) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setCityPickerLoading(true);
        setCityPickerError('');
        const value = cityPickerQuery.trim();
        const response = value
          ? await api.get('/location/search', { params: { q: value } })
          : await api.get('/location/cities', { params: { page: 1, limit: 40 } });

        if (cancelled) {
          return;
        }

        const rawItems = value
          ? Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.items)
              ? response.data.items
              : Array.isArray(response.data)
                ? response.data
                : []
          : response.data?.data || response.data?.items || [];

        const normalizedItems = rawItems
          .map((item) => ({
            _id: String(item?._id || item?.id || ''),
            name: String(item?.name || '')
          }))
          .filter((item) => item._id && item.name);

        setCityPickerOptions(normalizedItems);
      } catch (_error) {
        if (!cancelled) {
          setCityPickerOptions([]);
          setCityPickerError('Şehir listesi yüklenemedi. Lütfen tekrar dene.');
        }
      } finally {
        if (!cancelled) {
          setCityPickerLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cityPickerQuery, isCityPickerOpen]);

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
    nativeAuthPerf('home_mounted', { surfaceVariant });
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
  }, [surfaceVariant]);

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

  const bootstrapHomeAfterNativeLogin = useCallback(
    async (event) => {
      const markerAt = readNativeLoginBootstrapPending();
      const completedAt = Number(event?.detail?.completedAt || markerAt || Date.now());
      if (nativeBootstrapInFlightRef.current || (completedAt && completedAt === nativeBootstrapHandledRef.current)) {
        return;
      }
      nativeBootstrapInFlightRef.current = true;
      nativeBootstrapHandledRef.current = completedAt || Date.now();
      if (markerAt) {
        nativeAuthPerf('home_marker_detected', { completedAt: markerAt });
      }
      nativeAuthPerf('app_bootstrap_requested', { source: event?.type || 'manual' });
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
      setIsFilterSheetOpen(false);
      setCreateSheetState('closed');
      setIsCreateSheetMounted(false);
      setIsSearchTriggerOpen(false);
      setLoading(true);
      nativeAuthPerf('home_fetch_started');
      try {
        await Promise.allSettled([
          fetchRFQs({ nextPage: 1, replace: true, isRefresh: true }),
          fetchCurrentUser(),
          fetchFavorites(),
          fetchLocationSelection()
        ]);
        nativeAuthPerf('home_fetch_done');
        clearNativeLoginBootstrapPending();
        nativeAuthPerf('marker_cleared');
        nativeAuthPerf('app_bootstrap_done');
      } finally {
        nativeBootstrapInFlightRef.current = false;
      }
    },
    [fetchCurrentUser, fetchFavorites, fetchLocationSelection, fetchRFQs]
  );

  useEffect(() => {
    window.addEventListener('native-login-completed', bootstrapHomeAfterNativeLogin);
    window.addEventListener('native-auth-hydrated', bootstrapHomeAfterNativeLogin);
    if (readNativeLoginBootstrapPending()) {
      bootstrapHomeAfterNativeLogin({ type: 'native-login-marker-mount' });
    }
    return () => {
      window.removeEventListener('native-login-completed', bootstrapHomeAfterNativeLogin);
      window.removeEventListener('native-auth-hydrated', bootstrapHomeAfterNativeLogin);
    };
  }, [bootstrapHomeAfterNativeLogin]);

  useEffect(() => {
    if (!isNativeCapacitorRuntime() || pathname !== '/app') {
      return undefined;
    }
    if (!localStorage.getItem('token')) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      if (loading || (!rfqs.length && !error)) {
        bootstrapHomeAfterNativeLogin({ type: 'native-app-safe-refetch', detail: { completedAt: Date.now() } });
      }
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [bootstrapHomeAfterNativeLogin, error, loading, pathname, rfqs.length]);

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
      if (filters.segment) {
        query.set('segment', String(filters.segment));
      }
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
    [filters.category, filters.city, filters.radius, filters.segment, handleAuthFailure]
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
          params: {
            page: 1,
            limit: 100,
            segment: filters.segment || undefined,
            category: filters.category || undefined
          },
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
            segment: filters.segment || undefined,
            category: filters.category || undefined,
            cityId: fallbackCityId,
            districtId: filters.districtId || undefined
          },
        headers: { 'Cache-Control': 'no-cache' }
      });
      setNearbyRFQs(response.data?.data || response.data?.items || []);
    } catch (fallbackError) {
      cityFallbackAttemptedRef.current = { key: fallbackKey, failed: true };
      setToast('Şehir filtreleme geçici olarak çalışmıyor, tüm ilanlar gösteriliyor.');
      window.setTimeout(() => setToast(null), 2000);
      try {
        const response = await api.get('/rfq', {
          params: {
            page: 1,
            limit: 100,
            segment: filters.segment || undefined,
            category: filters.category || undefined
          },
          headers: { 'Cache-Control': 'no-cache' }
        });
        setNearbyRFQs(response.data?.data || response.data?.items || []);
      } catch (_error) {
        const selectedName = String(filters.city || '').toLowerCase();
        const cityOnly = rfqs.filter((item) => String(getCityName(item)).toLowerCase() === selectedName);
        setNearbyRFQs(cityOnly);
      }
    }
  }, [filters.category, filters.city, filters.cityId, filters.districtId, filters.segment, getCityName, rfqs, setToast]);

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
    if (!previewDragging) {
      return undefined;
    }

    const handlePointerMove = (event) => onPreviewDragMove(event);
    const handlePointerUp = () => endPreviewDrag();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [endPreviewDrag, onPreviewDragMove, previewDragging]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMapAreaFilterActive(false);
    setMapAreaFilterIds(null);
    setMapHasMoved(false);
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
    const next = Math.min(
      Math.max(Number(value) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default, minRadiusKm),
      maxRadiusKm
    );
    updateFilter('radius', next);
    setDraftFilters((prev) => (prev ? { ...prev, radius: next } : prev));
  }, [maxRadiusKm, minRadiusKm, radiusConfig.default, updateFilter]);

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
      setError(fetchError.response?.data?.message || 'Yakın talepler alınamadı.');
    } finally {
      setNearbyLoading(false);
    }
  }, [fetchNearbyByCoords, handleAuthFailure, userCoords]);

  useEffect(() => {
    fetchNearby();
  }, [fetchNearby, pathname, filters]);

  useEffect(() => {
    const handleRFQCreated = (event) => {
      const created = event?.detail?.rfq;
      if (created?._id) {
        setRfqs((prev) => mergeUniqueRFQs([created], prev));
        setNearbyRFQs((prev) => mergeUniqueRFQs([created], prev));
      }
      fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
      fetchNearby();
    };

    window.addEventListener('talepet:rfq-created', handleRFQCreated);
    return () => window.removeEventListener('talepet:rfq-created', handleRFQCreated);
  }, [fetchNearby, fetchRFQs, mergeUniqueRFQs]);

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
    if (isFilterSheetOpen) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isFilterSheetOpen]);

  const handleApplyFilters = useCallback(() => {
    const nextFilters = draftFilters || filters;
    const nextSelectedCity =
      nextFilters.cityId || nextFilters.city
        ? { _id: nextFilters.cityId || '', name: nextFilters.city || '' }
        : null;
    const nextSelectedDistrict =
      nextFilters.districtId || nextFilters.district
        ? {
            _id: nextFilters.districtId || '',
            name: nextFilters.district || '',
            cityId: nextFilters.cityId || ''
          }
        : null;

    setSelectedCity(nextSelectedCity);
    setSelectedDistrict(nextSelectedDistrict);
    setLocationSelection(
      nextSelectedCity
        ? {
            city: nextSelectedCity,
            district: nextSelectedDistrict
          }
        : null
    );
    localStorage.removeItem(RFQ_CACHE_KEY);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      ...nextFilters
    }));
    if (nextFilters.sort) {
      setSortKey(nextFilters.sort);
    }
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
  }, [draftFilters, fetchRFQs, filters, resultsToastTimerRef, resultsToastHideTimerRef, setSelectedCity, setSelectedDistrict]);

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

  const buildAlertPayload = useCallback(() => {
    const base = draftFilters || filters;
    const keyword = String(searchQuery || '').trim();
    if (keyword) {
      return { type: 'keyword', keyword };
    }
    if (base.category && base.cityId && base.districtId) {
      return { type: 'category_city_district', categoryId: base.category, cityId: base.cityId, districtId: base.districtId };
    }
    if (base.category && base.cityId) {
      return { type: 'category_city', categoryId: base.category, cityId: base.cityId };
    }
    if (base.category) {
      return { type: 'category', categoryId: base.category };
    }
    return null;
  }, [draftFilters, filters, searchQuery]);

  const handleCreateAlert = useCallback(async () => {
    if (!currentUserId) {
      navigate('/login');
      return;
    }
    const payload = buildAlertPayload();
    if (!payload) {
      setToast('Takip icin once kategori veya arama sec.');
      return;
    }
      try {
        setAlertSubmitting(true);
        const response = await api.post('/me/alerts', payload);
        const backfilledCount = Number(response.data?.backfilledCount || 0);
        setToast(
          backfilledCount > 0
            ? `Takip oluşturuldu. ${backfilledCount} mevcut talep eklendi.`
            : 'Takip oluşturuldu. Yeni ilanlarda bildirim alacaksın.'
        );
      } catch (requestError) {
      const status = requestError.response?.status;
      if (status === 409) {
        setToast('Bu takip zaten var.');
      } else {
        setToast(requestError.response?.data?.message || 'Takip oluşturulamadı.');
      }
    } finally {
      setAlertSubmitting(false);
    }
  }, [buildAlertPayload, currentUserId, navigate, setToast]);

  const handleIncreaseKm = useCallback(() => {
    const nextRadius = Math.min(
      (Number(filters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default) + 10,
      maxRadiusKm
    );
    handleRadiusChange(nextRadius);
  }, [filters.radius, handleRadiusChange, maxRadiusKm, radiusConfig.default]);

  const getCreateSheetSnapPoints = useCallback(() => {
    const vh = window.innerHeight || 0;
    const sheetHeight =
      createSheetRef.current?.getBoundingClientRect().height || Math.round(vh * 0.88);
    const expandedVisible = Math.min(sheetHeight, vh * 0.86);
    const midVisible = Math.min(sheetHeight, vh * 0.68);
    const collapsedVisible = Math.min(sheetHeight, vh * 0.32);
    const closedVisible = Math.min(sheetHeight, vh * 0.09);
    const expanded = Math.max(sheetHeight - expandedVisible, 0);
    const mid = Math.max(sheetHeight - midVisible, expanded);
    const collapsed = Math.max(sheetHeight - collapsedVisible, mid);
    const closed = Math.max(sheetHeight - closedVisible, collapsed);
    createSheetSnapRef.current = { expanded, mid, collapsed, closed };
    return createSheetSnapRef.current;
  }, []);

  const applyCreateSheetTranslate = useCallback((value) => {
    createSheetDragTranslateRef.current = value;
    if (createSheetRef.current) {
      createSheetRef.current.style.transform = `translate3d(-50%, ${value}px, 0)`;
    }
  }, []);

  const setCreateSheetTranslate = useCallback((value, { syncState = false } = {}) => {
    createSheetDragTranslateRef.current = value;
    if (syncState) {
      setCreateSheetRenderTranslate(value);
    }
    applyCreateSheetTranslate(value);
  }, [applyCreateSheetTranslate]);

  const closeCreateSheet = useCallback(({ immediate = false, restoreBottomNav = true } = {}) => {
    if (createSheetCloseTimerRef.current) {
      window.clearTimeout(createSheetCloseTimerRef.current);
      createSheetCloseTimerRef.current = null;
    }

    setCreateSheetState('closed');

    if (!immediate) {
      const snap = getCreateSheetSnapPoints();
      setCreateSheetTranslate(snap.closed, { syncState: true });
    }

    if (restoreBottomNav) {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }

    if (immediate) {
      setCreateSheetRenderTranslate(0);
      setIsCreateSheetMounted(false);
      return;
    }

    createSheetCloseTimerRef.current = window.setTimeout(() => {
      setIsCreateSheetMounted(false);
    }, 350);
  }, [getCreateSheetSnapPoints, setCreateSheetTranslate]);

  const closeCompetingSheets = useCallback((keep) => {
    if (keep !== 'filter') {
      setIsFilterSheetOpen(false);
      setDraftFilters(null);
    }
    if (keep !== 'category') {
      setIsCategoryModalOpen(false);
    }
    if (keep !== 'city-picker') {
      setIsCityPickerOpen(false);
    }
    if (keep !== 'create') {
      closeCreateSheet({ immediate: true, restoreBottomNav: false });
    }
  }, [closeCreateSheet]);

  useEffect(() => {
    const openFilterSheet = () => {
      closeCompetingSheets('filter');
      setDraftFilters({ ...filters });
      setIsFilterSheetOpen(true);
    };
    window.addEventListener('open-rfq-filter-sheet', openFilterSheet);
    return () => {
      window.removeEventListener('open-rfq-filter-sheet', openFilterSheet);
    };
  }, [closeCompetingSheets, filters]);

  const handleSelectCity = useCallback(() => {
    if (isWebSurface) {
      closeCompetingSheets('city-picker');
      setCityPickerQuery(selectedCity?.name || '');
      setCityPickerError('');
      setIsCityPickerOpen(true);
      return;
    }
    closeCompetingSheets('filter');
    window.dispatchEvent(new Event('open-rfq-filter-sheet'));
    window.setTimeout(() => {
      const input = document.querySelector('.city-search-input');
      if (input) {
        input.focus();
      }
    }, 250);
  }, [closeCompetingSheets, isWebSurface, selectedCity?.name]);

  const handleWebsiteCitySelect = useCallback((city) => {
    const normalizedCity = city?._id && city?.name
      ? { _id: String(city._id), name: String(city.name) }
      : null;

    setSelectedCity(normalizedCity);
    setSelectedDistrict(null);
    setLocationSelection(
      normalizedCity
        ? {
            city: normalizedCity,
            district: null
          }
        : null
    );
    localStorage.removeItem(RFQ_CACHE_KEY);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      city: normalizedCity?.name || null,
      cityId: normalizedCity?._id || null,
      district: null,
      districtId: null
    }));
    setDraftFilters(null);
    setIsCityPickerOpen(false);
    setCityPickerQuery(normalizedCity?.name || '');
  }, [setSelectedCity, setSelectedDistrict]);

  const openCreateSheet = useCallback(() => {
    if (createSheetCloseTimerRef.current) {
      window.clearTimeout(createSheetCloseTimerRef.current);
      createSheetCloseTimerRef.current = null;
    }
    closeCompetingSheets('create');
    setIsCreateSheetMounted(true);
    window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    window.requestAnimationFrame(() => {
      setCreateSheetState('mid');
      const snap = getCreateSheetSnapPoints();
      setCreateSheetTranslate(snap.mid, { syncState: true });
    });
  }, [closeCompetingSheets, getCreateSheetSnapPoints, setCreateSheetTranslate]);

  useEffect(() => {
    const handleOpenCreateSheet = () => openCreateSheet();
    window.addEventListener('open-rfq-create-sheet', handleOpenCreateSheet);
    return () => {
      window.removeEventListener('open-rfq-create-sheet', handleOpenCreateSheet);
    };
  }, [openCreateSheet]);

  useEffect(() => {
    const handleExpandCreateSheet = () => {
      if (!isCreateSheetMounted || createSheetState === 'closed') return;
      setCreateSheetState('expanded');
      window.requestAnimationFrame(() => {
        const snap = getCreateSheetSnapPoints();
        setCreateSheetTranslate(snap.expanded, { syncState: true });
      });
    };

    window.addEventListener('rfq-create-sheet:expand', handleExpandCreateSheet);
    return () => {
      window.removeEventListener('rfq-create-sheet:expand', handleExpandCreateSheet);
    };
  }, [createSheetState, getCreateSheetSnapPoints, isCreateSheetMounted, setCreateSheetTranslate]);

  useEffect(() => {
    if (isCreateSheetMounted) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isCreateSheetMounted]);

  const {
    dragging: isCreateSheetDragging,
    onSurfacePointerDown: onCreateSheetSurfacePointerDown,
    resetDragState: resetCreateSheetDrag
  } = useBottomSheetDrag({
    sheetRef: createSheetRef,
    getSnapPoints: getCreateSheetSnapPoints,
    getCurrentTranslate: () => createSheetDragTranslateRef.current,
    onTranslate: applyCreateSheetTranslate,
    getSnapCandidates: (points) => [
      { key: 'expanded', value: points.expanded },
      { key: 'mid', value: points.mid },
      { key: 'collapsed', value: points.collapsed },
      { key: 'closed', value: points.closed }
    ],
    onDragStart: () => {
      if (createSheetRef.current) {
        createSheetRef.current.style.transition = 'none';
      }
    },
    onResolveSnap: ({ nearestKey, nearestValue }) => {
      if (createSheetRef.current) {
        createSheetRef.current.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      }
      if (nearestKey === 'closed') {
        closeCreateSheet();
        return;
      }
      setCreateSheetState(nearestKey);
      setCreateSheetTranslate(nearestValue, { syncState: true });
    },
    draggingBodyClass: 'sheet-dragging'
  });

  useEffect(() => () => {
    resetCreateSheetDrag();
  }, [resetCreateSheetDrag]);

  useEffect(() => {
    if (isCreateSheetMounted && createSheetState !== 'closed') {
      lockSheetSurface(createSheetLockKeyRef.current);
      return () => unlockSheetSurface(createSheetLockKeyRef.current);
    }

    unlockSheetSurface(createSheetLockKeyRef.current);
    return undefined;
  }, [createSheetState, isCreateSheetMounted]);

  const handleOpenCategoryModal = useCallback(() => {
    closeCompetingSheets('category');
    setIsCategoryModalOpen(true);
  }, [closeCompetingSheets]);

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
    categoryItems.forEach((item) => {
      if (!item) return;
      const id = item._id ? String(item._id) : '';
      if (id) map.set(id, item);
      if (item.slug) map.set(String(item.slug), item);
      if (item.name) map.set(String(item.name).toLowerCase(), item);
    });
    return map;
  }, [categoryItems]);

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

  const selectedCategoryFamilyIds = useMemo(() => {
    const selectedId = String(appliedFilters.category || '');
    if (!selectedId) {
      return null;
    }
    const selectedCategory =
      categoryIndex.get(selectedId) ||
      categoryIndex.get(selectedId.toLowerCase()) ||
      null;
    const familyIds = selectedCategory?.categoryFamilyIds?.length
      ? selectedCategory.categoryFamilyIds
      : [selectedId];
    return new Set(familyIds.map((item) => String(item)));
  }, [appliedFilters.category, categoryIndex]);

  const isCategoryMatch = useCallback(
    (item) => {
      if (!selectedCategoryFamilyIds) {
        return true;
      }
      const categoryKey = String(getCategoryKey(item) || '');
      if (selectedCategoryFamilyIds.has(categoryKey)) {
        return true;
      }
      const resolved = resolveCategoryItem(item?.category);
      if (!resolved) {
        return false;
      }
      const resolvedIds = [
        resolved._id,
        resolved.id,
        resolved.slug,
        resolved.name,
        resolved.parentId
      ].filter(Boolean).map((value) => String(value));
      return resolvedIds.some((value) => selectedCategoryFamilyIds.has(value));
    },
    [getCategoryKey, resolveCategoryItem, selectedCategoryFamilyIds]
  );

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

  const radiusCenter = useMemo(() => {
    if (currentLocationMatchesFilters && userCoords) {
      return userCoords;
    }
    if (!userCoords && appliedFilters.city && cityCenterCoords) {
      return cityCenterCoords;
    }
    return null;
  }, [appliedFilters.city, cityCenterCoords, currentLocationMatchesFilters, userCoords]);

  const canonicalSourceRFQs = useMemo(
    () => mergeUniqueRFQs(rfqs, nearbyRFQs),
    [mergeUniqueRFQs, nearbyRFQs, rfqs]
  );

  const enrichedRFQs = useMemo(() => {
    return canonicalSourceRFQs.map((rfq) => {
      const isPremium = isPremiumRFQ(rfq);
      const rfqCoords = getRFQCoords(rfq);
      const distanceKm =
        typeof rfq?.distance === 'number'
          ? rfq.distance / 1000
          : radiusCenter && rfqCoords
            ? distanceInKm(radiusCenter.lat, radiusCenter.lng, Number(rfqCoords.lat), Number(rfqCoords.lng))
            : null;
      const radiusLimit = Number(appliedFilters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
      const isCityWide = cityFallbackEnabled && radiusLimit >= maxRadiusKm && Boolean(appliedFilters.city);
      const isNearby = typeof distanceKm === 'number' ? (isCityWide ? true : distanceKm <= radiusLimit) : false;

      return {
        ...rfq,
        isPremium,
        distanceKm,
        isNearby
      };
    });
  }, [appliedFilters.city, appliedFilters.radius, canonicalSourceRFQs, cityFallbackEnabled, distanceInKm, getRFQCoords, isPremiumRFQ, maxRadiusKm, radiusCenter, radiusConfig.default]);

  const filteredEnrichedRFQs = useMemo(() => {
    return enrichedRFQs.filter((item) => {
      const cityMatch = appliedFilters.city
        ? String(getCityName(item)).toLowerCase() === String(appliedFilters.city).toLowerCase()
        : true;
      const districtMatch = appliedFilters.district
        ? String(getDistrictName(item)).toLowerCase() === String(appliedFilters.district).toLowerCase()
        : true;
      const categoryMatch = isCategoryMatch(item);
      const radiusLimit = Number(appliedFilters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
      const isCityWide = cityFallbackEnabled && radiusLimit >= maxRadiusKm && Boolean(appliedFilters.city);
      const radiusMatch = radiusCenter
        ? typeof item.distanceKm === 'number'
          ? (isCityWide ? true : item.distanceKm <= radiusLimit)
          : true
        : true;
      return cityMatch && districtMatch && categoryMatch && radiusMatch;
    });
  }, [appliedFilters.city, appliedFilters.district, appliedFilters.radius, cityFallbackEnabled, enrichedRFQs, getCityName, getDistrictName, isCategoryMatch, maxRadiusKm, radiusCenter, radiusConfig.default]);

  const canonicalNearbyRFQs = useMemo(
    () => filteredEnrichedRFQs.filter((item) => item.isNearby),
    [filteredEnrichedRFQs]
  );

  const applySort = useCallback(
    (items = []) => {
      const next = [...items];
      return next.sort((a, b) => compareRFQsBySortKey(a, b, sortKey));
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

    if (canonicalNearbyRFQs.length) {
      const sortedByRecommendation = [...canonicalNearbyRFQs].sort((a, b) => scoreByCategory(b) - scoreByCategory(a));
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
  }, [applySort, canonicalNearbyRFQs, favoriteItems, filteredEnrichedRFQs, getCategoryKey]);

  const sortPromotionGroups = useCallback(
    (items = []) =>
      items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
          const tierDiff = getRfqPromotionTier(a.item) - getRfqPromotionTier(b.item);
          if (tierDiff !== 0) {
            return tierDiff;
          }
          return compareRFQsBySortKey(a.item, b.item, sortKey) || a.index - b.index;
        })
        .map(({ item }) => item),
    [sortKey]
  );

  const featuredIds = useMemo(() => new Set(featuredRFQs.map((item) => item._id)), [featuredRFQs]);

  const nearbyOnlyRFQs = useMemo(() => {
    const source = canonicalNearbyRFQs.length ? canonicalNearbyRFQs : filteredEnrichedRFQs.filter((item) => item.isNearby);
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
  }, [applySort, canonicalNearbyRFQs, favoriteItems, featuredIds, filteredEnrichedRFQs, getCategoryKey]);
  const featuredRFQsSorted = useMemo(() => sortPromotionGroups(featuredRFQs), [featuredRFQs, sortPromotionGroups]);
  const nearbyOnlyRFQsSorted = useMemo(() => sortPromotionGroups(nearbyOnlyRFQs), [nearbyOnlyRFQs, sortPromotionGroups]);
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
    return sortPromotionGroups(combined);
  }, [featuredRFQsSorted, normalRFQs, premiumUnderFeaturedRFQs, sortPromotionGroups]);
  const hasDistanceData = useMemo(
    () =>
      canonicalNearbyRFQs.some(
        (item) => Number.isFinite(Number(item?.distanceKm)) || Number.isFinite(Number(item?.distance))
      ),
    [canonicalNearbyRFQs]
  );
  const filteredOrderedRFQs = orderedRFQs;
  const selectedCityLabel = useMemo(
    () => deferredFilters.city || selectedCity?.name || 'Tüm şehir',
    [deferredFilters.city, selectedCity?.name]
  );
  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((item) => item.value === sortKey)?.label || 'Gelişmiş Sıralama',
    [sortKey]
  );
  const mapRadiusCenter = radiusCenter;
  const hasRadiusCenter = Boolean(mapRadiusCenter && Number.isFinite(mapRadiusCenter.lat) && Number.isFinite(mapRadiusCenter.lng));
  const isMapCityWide = cityFallbackEnabled && mapRadiusKm >= maxRadiusKm && Boolean(filters.city || selectedCity?.name);
  const quickFilteredRFQs = useMemo(() => {
    if (sortKey === 'advanced') {
      return sortPromotionGroups(filteredOrderedRFQs);
    }
    return sortPromotionGroups(filteredOrderedRFQs);
  }, [filteredOrderedRFQs, sortKey, sortPromotionGroups]);

  const radiusFilteredRFQs = useMemo(() => {
    if (!hasRadiusCenter || mapRadiusKm <= 0 || isMapCityWide) {
      return quickFilteredRFQs;
    }
    return quickFilteredRFQs.filter((item) => {
      const coords = getRFQCoords(item);
      if (!coords) {
        const selectedCity = String(appliedFilters.city || '').trim().toLowerCase();
        if (!selectedCity) {
          return false;
        }
        const itemCity = String(getCityName(item) || '').trim().toLowerCase();
        if (itemCity !== selectedCity) {
          return false;
        }
        const selectedDistrict = String(appliedFilters.district || '').trim().toLowerCase();
        if (!selectedDistrict) {
          return true;
        }
        return String(getDistrictName(item) || '').trim().toLowerCase() === selectedDistrict;
      }
      const distance = getDistanceKm(mapRadiusCenter, coords);
      return typeof distance === 'number' && distance <= mapRadiusKm;
    });
  }, [
    appliedFilters.city,
    appliedFilters.district,
    getCityName,
    getDistrictName,
    getRFQCoords,
    hasRadiusCenter,
    isMapCityWide,
    mapRadiusCenter,
    mapRadiusKm,
    quickFilteredRFQs
  ]);

  const canonicalFilteredRFQs = useMemo(() => {
    if (!mapAreaFilterActive || !mapAreaFilterIds) {
      return radiusFilteredRFQs;
    }
    return radiusFilteredRFQs.filter((item) => mapAreaFilterIds.has(String(item._id)));
  }, [mapAreaFilterActive, mapAreaFilterIds, radiusFilteredRFQs]);

  useEffect(() => {
    localStorage.setItem('rfq_sortKey', sortKey);
    setFilters((prev) => ({ ...prev, sort: sortKey }));
  }, [sortKey]);

  const mapSearchBaseItems = useMemo(
    () => (Array.isArray(radiusFilteredRFQs) ? radiusFilteredRFQs : []),
    [radiusFilteredRFQs]
  );

  const mapBaseItems = useMemo(() => {
    return [...canonicalFilteredRFQs]
      .filter((item) => Boolean(getRFQCoords(item)))
      .filter((item) => (!showActiveOnly ? true : isActiveRequest(item, nowTs)));
  }, [canonicalFilteredRFQs, getRFQCoords, nowTs, showActiveOnly]);

  const mapItems = useMemo(() => mapBaseItems, [mapBaseItems]);
  const locationFocusItems = useMemo(() => {
    if (appliedDistrictKey) {
      return mapBaseItems.filter((item) => String(getDistrictName(item) || '').trim().toLowerCase() === appliedDistrictKey);
    }
    if (appliedCityKey) {
      return mapBaseItems.filter((item) => String(getCityName(item) || '').trim().toLowerCase() === appliedCityKey);
    }
    return mapBaseItems;
  }, [appliedCityKey, appliedDistrictKey, getCityName, getDistrictName, mapBaseItems]);

  const locationFocusBounds = useMemo(() => {
    let south = Number.POSITIVE_INFINITY;
    let west = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let count = 0;

    locationFocusItems.forEach((item) => {
      const coords = getRFQCoords(item);
      if (!coords) {
        return;
      }
      south = Math.min(south, coords.lat);
      west = Math.min(west, coords.lng);
      north = Math.max(north, coords.lat);
      east = Math.max(east, coords.lng);
      count += 1;
    });

    if (!count) {
      return null;
    }

    return {
      south,
      west,
      north,
      east,
      count,
      center: {
        lat: (south + north) / 2,
        lng: (west + east) / 2
      }
    };
  }, [getRFQCoords, locationFocusItems]);

  const selectedMapItem = useMemo(
    () => (selectedRfqId ? mapItems.find((item) => getRFQIdentity(item) === selectedRfqId) || null : null),
    [mapItems, selectedRfqId]
  );
  const selectedPreviewItem = useMemo(() => selectedMapItem || selectedRfq || null, [selectedMapItem, selectedRfq]);

  useEffect(() => {
    if (!selectedRfqId) {
      return;
    }
    if (!selectedPreviewItem) {
      setSelectedRfq(null);
    }
  }, [selectedPreviewItem, selectedRfqId]);

  const mapCenter = useMemo(() => {
    if (locationFocusBounds?.center) {
      return [locationFocusBounds.center.lat, locationFocusBounds.center.lng];
    }
    if (radiusCenter) {
      return [radiusCenter.lat, radiusCenter.lng];
    }
    if (mapItems.length) {
      const coords = getRFQCoords(mapItems[0]);
      if (coords) {
        return [coords.lat, coords.lng];
      }
    }
    return [mapSettings.defaultCenter?.lat || 41.0082, mapSettings.defaultCenter?.lng || 28.9784];
  }, [getRFQCoords, locationFocusBounds, mapItems, mapSettings.defaultCenter, radiusCenter]);

  const listIsEmpty = radiusFilteredRFQs.length === 0;
  const mapIsEmpty = mapItems.length === 0;
  const hasCityFilter = Boolean(filters.city || selectedCity?.name);
  const selectedKm = Number(filters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
  const canApplyFilters = Boolean((draftFilters || filters).city || (draftFilters || filters).cityId);
  const hasMapCoords = mapBaseItems.length > 0;
  const effectiveListItems = canonicalFilteredRFQs;
  const effectiveSelectedCityLabel = appliedFilters.city || selectedCityLabel;
  const effectiveHasCityFilter = Boolean(appliedFilters.city);
  const effectiveSelectedKm = Number(appliedFilters.radius) || selectedKm;
  const effectiveIsMapCityWide = cityFallbackEnabled && mapRadiusKm >= maxRadiusKm && Boolean(appliedFilters.city);
  const effectiveHasMapCoords = mapSearchBaseItems.length > 0;
  const effectiveListIsEmpty = effectiveListItems.length === 0;
  const analyticsListContext = useMemo(() => ({
    userId: currentUserId || undefined,
    source: isWebSurface ? 'web_rfq_list' : 'app_rfq_list',
    category: categoryLabel || filters.category || undefined,
    segment: filters.segment || undefined,
    city: appliedFilters.city || selectedCity?.name || undefined,
    district: appliedFilters.district || selectedDistrict?.name || undefined,
    resultCount: effectiveListItems.length
  }), [
    appliedFilters.city,
    appliedFilters.district,
    categoryLabel,
    currentUserId,
    effectiveListItems.length,
    filters.category,
    filters.segment,
    isWebSurface,
    selectedCity?.name,
    selectedDistrict?.name
  ]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const viewKey = JSON.stringify(analyticsListContext);
    if (feedViewKeyRef.current === viewKey) {
      return;
    }
    feedViewKeyRef.current = viewKey;
    feedScrollMarksRef.current = new Set();
    cardImpressionSeenRef.current = new Set();
    trackAnalyticsEvent('rfq_feed_view', analyticsListContext);
  }, [analyticsListContext, loading]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const thresholds = [25, 50, 75, 100];
    const onScroll = () => {
      if (feedScrollRafRef.current) {
        return;
      }
      feedScrollRafRef.current = window.requestAnimationFrame(() => {
        feedScrollRafRef.current = null;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        const scrollHeight = document.documentElement.scrollHeight || 1;
        const depth = Math.min(100, Math.round(((scrollTop + viewportHeight) / scrollHeight) * 100));
        thresholds.forEach((threshold) => {
          if (depth >= threshold && !feedScrollMarksRef.current.has(threshold)) {
            feedScrollMarksRef.current.add(threshold);
            trackAnalyticsEvent('rfq_feed_scroll_depth', {
              ...analyticsListContext,
              scrollDepth: threshold,
              visibleCardCount: cardImpressionSeenRef.current.size
            });
          }
        });
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (feedScrollRafRef.current) {
        window.cancelAnimationFrame(feedScrollRafRef.current);
        feedScrollRafRef.current = null;
      }
    };
  }, [analyticsListContext, loading]);

  useEffect(() => {
    if (loading || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    if (cardImpressionObserverRef.current) {
      cardImpressionObserverRef.current.disconnect();
    }

    cardImpressionObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.45) {
          return;
        }
        const element = entry.target;
        const rfqId = element.getAttribute('data-rfq-id');
        if (!rfqId || cardImpressionSeenRef.current.has(rfqId)) {
          return;
        }
        cardImpressionSeenRef.current.add(rfqId);
        trackAnalyticsEvent('rfq_card_impression', {
          ...analyticsListContext,
          rfqId,
          category: element.getAttribute('data-rfq-category') || analyticsListContext.category,
          cardIndex: Number(element.getAttribute('data-rfq-index') || 0),
          isPremium: element.getAttribute('data-rfq-premium') === 'true',
          isFeatured: element.getAttribute('data-rfq-featured') === 'true'
        });
      });
    }, { threshold: [0.45] });

    const nodes = document.querySelectorAll('[data-rfq-card="true"]');
    nodes.forEach((node) => cardImpressionObserverRef.current?.observe(node));

    return () => {
      cardImpressionObserverRef.current?.disconnect();
    };
  }, [analyticsListContext, effectiveListItems, loading]);
  const isCurrentLocationContext = Boolean(radiusCenter && currentLocationMatchesFilters);
  const locationFocusKey = useMemo(() => {
    const radiusValue = Number(appliedFilters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
    if (isCurrentLocationContext && radiusCenter) {
      return `current:${radiusCenter.lat.toFixed(4)}:${radiusCenter.lng.toFixed(4)}:${radiusValue}`;
    }
    if (appliedDistrictKey) {
      return `district:${appliedDistrictKey}:${effectiveListItems.length}`;
    }
    if (appliedCityKey) {
      return `city:${appliedCityKey}:${effectiveListItems.length}`;
    }
    return '';
  }, [appliedCityKey, appliedDistrictKey, appliedFilters.radius, effectiveListItems.length, isCurrentLocationContext, radiusCenter, radiusConfig.default]);
  const mapFocusTarget = useMemo(() => {
    const radiusValue = Number(appliedFilters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
    if (isCurrentLocationContext && radiusCenter) {
      return {
        key: locationFocusKey,
        center: radiusCenter,
        zoom: radiusValue <= 10 ? 12 : radiusValue <= 25 ? 11 : 10
      };
    }
    if (locationFocusBounds?.count > 1 && (appliedCityKey || appliedDistrictKey)) {
      return {
        key: locationFocusKey,
        bounds: locationFocusBounds,
        maxZoom: appliedDistrictKey ? 12 : 11
      };
    }
    if (locationFocusBounds?.center && (appliedCityKey || appliedDistrictKey)) {
      return {
        key: locationFocusKey,
        center: locationFocusBounds.center,
        zoom: appliedDistrictKey ? 12 : 11
      };
    }
    return null;
  }, [appliedCityKey, appliedDistrictKey, appliedFilters.radius, isCurrentLocationContext, locationFocusBounds, locationFocusKey, radiusCenter, radiusConfig.default]);
  const previousLocationFocusKeyRef = useRef('');

  useEffect(() => {
    if (!locationFocusKey) {
      previousLocationFocusKeyRef.current = '';
      return;
    }
    if (!previousLocationFocusKeyRef.current) {
      previousLocationFocusKeyRef.current = locationFocusKey;
      return;
    }
    if (previousLocationFocusKeyRef.current === locationFocusKey) {
      return;
    }
    previousLocationFocusKeyRef.current = locationFocusKey;
    setSelectedRfq(null);
  }, [locationFocusKey]);
  const [uiTexts, setUiTexts] = useState({
    searchHint: 'Yazdıkça liste filtrelenecek.',
    emptyCityTitle: 'Şehir seçerek talepleri gör',
    emptyCityDescription: 'Şehir seçerek bulunduğun bölgedeki talepleri görebilirsin.'
  });
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);

  useEffect(() => {
    let active = true;
    const loadUiTexts = async () => {
      try {
        const response = await api.get('/content/ui-texts');
        if (!active) return;
        setUiTexts((prev) => ({ ...prev, ...(response.data?.data || {}) }));
      } catch (_error) {
        // ignore UI text errors
      }
    };
    loadUiTexts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadHomeContent = async () => {
      try {
        const response = await api.get(`/content/home?ts=${Date.now()}`);
        if (!active) return;
        const nextHomeContent = normalizeHomeContent(response.data?.data || {});
        setHomeContent(nextHomeContent);
        if (window.localStorage?.getItem('talepet:debug-home-content') === '1') {
          console.info('HOME_CONTENT_LOADED', {
            isWebSurface,
            heroBanner: nextHomeContent.heroBanner,
            quickCategories: nextHomeContent.quickCategories?.length || 0
          });
        }
      } catch (_error) {
        // ignore content errors
      }
    };
    loadHomeContent();
    return () => {
      active = false;
    };
  }, [isWebSurface]);

  const normalizeSearch = useCallback((value) => String(value || '').toLowerCase().trim(), []);

  const saveSearchHistory = useCallback((next) => {
    setSearchHistory(next);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  }, []);

  const getSearchResultsCount = useCallback(
    (term) => {
      const query = normalizeSearch(term);
      if (!query) {
        return effectiveListItems.length;
      }
      return effectiveListItems.filter((item) => {
        const text = [
          item?.title,
          item?.description,
          getCategoryDisplayName(item?.category),
          getCityName(item),
          getDistrictName(item)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(query);
      }).length;
    },
    [effectiveListItems, getCategoryDisplayName, getCityName, getDistrictName, normalizeSearch]
  );

  const logSearchEvent = useCallback(
    async ({ term, source = 'manual', suggestionId, resultsCount } = {}) => {
      const normalized = String(term || '').trim();
      if (!normalized) return;
      try {
        await api.post('/search/log', {
          term: normalized,
          source,
          suggestionId: suggestionId || undefined,
          categoryId: filters.category || undefined,
          resultsCount: Number.isFinite(Number(resultsCount))
            ? Number(resultsCount)
            : getSearchResultsCount(normalized)
        });
      } catch (_error) {
        // ignore analytics errors
      }
    },
    [filters.category, getSearchResultsCount]
  );

  const pushSearchHistory = useCallback(
    (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) {
        return;
      }
      logSearchEvent({ term: normalized, source: 'manual', resultsCount: getSearchResultsCount(normalized) });
      const prev = Array.isArray(searchHistory) ? searchHistory : [];
      const without = prev.filter((item) => String(item || '').toLowerCase() !== normalized.toLowerCase());
      const next = [normalized, ...without].slice(0, 8);
      saveSearchHistory(next);
    },
    [logSearchEvent, saveSearchHistory, searchHistory]
  );

  useEffect(() => {
    const nextRadius = Number(filters.radius) || radiusConfig.default || DEFAULT_RADIUS_SETTINGS.default;
    setMapRadiusKm((prev) => (prev === nextRadius ? prev : nextRadius));
  }, [filters.radius, radiusConfig.default]);

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

  useEffect(() => {
    if (!isSortMenuOpen) {
      return undefined;
    }
    const handleOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setIsSortMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, [isSortMenuOpen]);

  const closeSearchSheet = useCallback(() => {
    pushSearchHistory(searchQuery);
    setIsSearchTriggerOpen(false);
  }, [pushSearchHistory, searchQuery]);

  const handleSortSelect = useCallback((value) => {
    setSortKey(value);
    setIsSortMenuOpen(false);
    setFilters((prev) => ({ ...prev, sort: value }));
  }, []);

  const handleCreateRFQ = useCallback(() => {
    window.dispatchEvent(new Event('open-rfq-create-sheet'));
  }, []);

  const handleHomeBannerNavigate = useCallback(
    (path) => {
      const nextPath = String(path || '').trim();
      if (!nextPath) return;
      if (nextPath === '/create') {
        handleCreateRFQ();
        return;
      }
      navigate(nextPath);
    },
    [handleCreateRFQ, navigate]
  );

  const handleRetry = useCallback(() => {
    fetchRFQs({ nextPage: 1, replace: true, isRefresh: true });
    fetchNearby();
  }, [fetchNearby, fetchRFQs]);


  const handleSearchThisArea = useCallback(() => {
    if (!mapBounds) {
      return;
    }

    const nextIds = new Set();
    mapSearchBaseItems.forEach((item) => {
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
  }, [getRFQCoords, mapBounds, mapSearchBaseItems]);

  const mapTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const mapAttribution = '&copy; OpenStreetMap contributors &copy; CARTO';

  const selectedRfqCoords = useMemo(() => {
    if (!selectedPreviewItem) {
      return null;
    }
    return getRFQCoords(selectedPreviewItem);
  }, [getRFQCoords, selectedPreviewItem]);

  const selectedRfqImages = useMemo(
    () => (selectedPreviewItem ? getCardImages(selectedPreviewItem) : []),
    [getCardImages, selectedPreviewItem]
  );
  const selectedRfqCategory = useMemo(
    () => (selectedPreviewItem ? getCategoryDisplayName(selectedPreviewItem.category) : ''),
    [getCategoryDisplayName, selectedPreviewItem]
  );
  const selectedRfqStatusLabel = useMemo(
    () => (selectedPreviewItem ? getRequestStatusLabel(selectedPreviewItem, nowTs) : ''),
    [nowTs, selectedPreviewItem]
  );
  const selectedRfqRemaining = useMemo(
    () => (selectedPreviewItem ? formatRemainingTime(selectedPreviewItem, nowTs) : ''),
    [nowTs, selectedPreviewItem]
  );
  const selectedRouteSummaryText = useMemo(() => {
    if (!routeSummary || typeof routeSummary !== 'object') {
      return '';
    }

    const parts = [];
    if (Number.isFinite(routeSummary.distanceKm)) {
      parts.push(`${routeSummary.distanceKm.toFixed(1)} km`);
    }
    if (Number.isFinite(routeSummary.durationMin)) {
      parts.push(`${Math.round(routeSummary.durationMin)} dk`);
    }
    return parts.join(' • ');
  }, [routeSummary]);

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
        if (!filters.segment) {
          if (isActive) {
            setCategoryItems([]);
            setInlineSubcategories([]);
            setFlatSubcategories([]);
          }
          return;
        }

        const response = await api.get('/categories', { params: { segment: filters.segment } });
        const flat = response.data?.data || response.data?.items || [];
        const tree = normalizeCategoryTree(
          response.data?.tree?.length ? response.data.tree : buildCategoryTree(flat),
          filters.segment
        );
        const allItems = flattenCategoryNodes(tree);
        const leafItems = flattenCategoryLeaves(tree);
        leafItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
        const subcats = leafItems.map((item) => ({
          ...item,
          parentId: item.parentId || null,
          parentName: item.parentName || ''
        }));
        subcats.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));

        if (isActive) {
          setCategoryItems(allItems);
          setInlineSubcategories(leafItems);
          setFlatSubcategories(subcats);
        }
      } catch (requestError) {
        if (isActive) {
          setCategoryItems([]);
          setInlineSubcategories([]);
          setFlatSubcategories([]);
        }
      }
    };

    fetchInlineCategories();

    return () => {
      isActive = false;
    };
  }, [filters.segment]);

  const handleCategorySelect = useCallback(
    (category) => {
      if (category?.segment && category.segment !== filters.segment) {
        updateFilter('segment', category.segment);
      }
      updateFilter('category', String(category._id));
      setCategoryLabel(Array.isArray(category.path) ? category.path.join(' > ') : category.name || '');
      setIsCategoryModalOpen(false);
    },
    [filters.segment, updateFilter]
  );

  const handleHomeQuickCategorySelect = useCallback(
    (item) => {
      const nextSegment = item?.segment || '';
      const nextCategoryId = item?.categoryId ? String(item.categoryId) : '';

      if (nextSegment && nextSegment !== filters.segment) {
        updateFilter('segment', nextSegment);
      }

      if (nextCategoryId) {
        updateFilter('category', nextCategoryId);
        const match = categoryItems.find((category) => String(category._id || '') === nextCategoryId);
        setCategoryLabel(match?.path?.length ? match.path.join(' > ') : match?.name || item.label || '');
      } else {
        updateFilter('category', null);
        setCategoryLabel('');
      }

      setSearchQuery('');
      setIsCategoryModalOpen(false);
      triggerHaptic('light');
    },
    [categoryItems, filters.segment, updateFilter]
  );

  const handleClearCategoryFilter = useCallback(() => {
    updateFilter('category', null);
    setCategoryLabel('');
    setIsCategoryModalOpen(false);
  }, [updateFilter]);

  const handleSegmentSelect = useCallback(
    (segment) => {
      updateFilter('segment', segment || null);
      updateFilter('category', null);
      setCategoryLabel('');
      setSearchQuery('');
      setIsCategoryModalOpen(false);
    },
    [updateFilter]
  );

  const activeParentName = useMemo(() => {
    const selectedId = String(filters.category || '');
    if (!selectedId) return '';
    const match = categoryItems.find((item) => String(item._id) === selectedId);
    return match?.parentName || '';
  }, [categoryItems, filters.category]);

  const suggestionResults = useMemo(() => {
    const query = normalizeSearch(deferredSearchQuery);
    if (!filters.segment) return [];
    if (!query) return [];
    const apiResults = searchSuggestions
      .filter((item) => normalizeSearch(item.term).includes(query))
      .map((item) => ({
        ...item,
        source: 'suggestion',
        name: item.term,
        parentName: item.parentName || ''
      }));
    if (apiResults.length) {
      apiResults.sort((a, b) => {
        const aName = normalizeSearch(a.name);
        const bName = normalizeSearch(b.name);
        const aExact = aName === query ? 1 : 0;
        const bExact = bName === query ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return aName.localeCompare(bName, 'tr');
      });
      return apiResults.slice(0, 10);
    }
    const results = flatSubcategories
      .filter((item) => normalizeSearch(item.name).includes(query))
      .map((item) => ({ ...item, source: 'category' }));
    results.sort((a, b) => {
      const aName = normalizeSearch(a.name);
      const bName = normalizeSearch(b.name);
      const aExact = aName === query ? 1 : 0;
      const bExact = bName === query ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return aName.localeCompare(bName, 'tr');
    });
    return results.slice(0, 10);
  }, [deferredSearchQuery, filters.segment, flatSubcategories, normalizeSearch, searchSuggestions]);

  const handleSuggestSelect = useCallback(
    (item) => {
      if (item.categoryId || item.category?._id || item.source === 'category') {
        const categoryId = String(item.categoryId || item.category?._id || '');
        updateFilter('category', categoryId);
        if (item.parentName) {
          setCategoryLabel(`${item.parentName} > ${item.name}`);
        } else {
          setCategoryLabel(item.name || '');
        }
      } else {
        setSearchQuery(item.name || '');
      }
      logSearchEvent({
        term: item.name || '',
        source: item.source === 'suggestion' ? 'suggestion' : 'manual',
        suggestionId: item.source === 'suggestion' ? item._id : undefined,
        resultsCount: getSearchResultsCount(item.name || '')
      });
      closeSearchSheet();
    },
    [closeSearchSheet, getSearchResultsCount, logSearchEvent, updateFilter]
  );

  const renderRFQCard = useCallback(
    (rfq, index, baseDelay = 0, variant = 'normal') => {
      const jobseekerMeta = rfq?.segment === 'jobseeker' ? rfq?.segmentMetadata || {} : null;
      const buyerId = getBuyerId(rfq);
      const isOwner = Boolean(currentUserId && buyerId === currentUserId);
      const isOpened = swipedCard.id === rfq._id;
      const isFavorite = favorites.includes(String(rfq._id));
      const animating = Boolean(favoriteAnimating[rfq._id]);
      const promotionTier = getRfqPromotionTier(rfq);
      const isPremium = promotionTier === 0;
      const isFeatured = promotionTier === 1;
      const categoryLabel = (() => {
        const fullLabel = getCategoryDisplayName(rfq.category) || 'Talep';
        const parts = fullLabel.split('>').map((item) => item.trim()).filter(Boolean);
        const readableLabel = parts[parts.length - 1] || fullLabel;
        return formatCategoryLabel(readableLabel, 'Talep');
      })();
      const publishedLabel = formatDate(rfq.createdAt || rfq.updatedAt || rfq.date);
      const distanceLabel =
        rfq?.distance ? `${(rfq.distance / 1000).toFixed(1)} km` : typeof rfq.distanceKm === 'number' ? `${rfq.distanceKm.toFixed(1)} km` : '';
      const fallbackDescriptionParts = [
        rfq?.productDetails?.brand,
        rfq?.productDetails?.model,
        rfq?.car?.brandName,
        rfq?.car?.modelName,
        jobseekerMeta?.expectedPay,
        rfq?.quantity ? `Miktar: ${rfq.quantity}` : ''
      ].filter(Boolean);
      const descriptionText = String(rfq?.description || '').trim() || fallbackDescriptionParts.join(' • ');

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
          setToast(isNowFavorite ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
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
          setToast(toggleError.response?.data?.message || 'Favori işlemi başarısız.');
          window.setTimeout(() => {
            setToast(null);
          }, 3000);
        }
      };

      return (
        <div
          key={rfq._id}
          className="rfq-swipe-wrap"
        >
          <div className="rfq-actions">
            <button
              type="button"
              className="secondary-btn swipe-btn"
              onClick={() => {
                trackAnalyticsEvent('rfq_card_click', {
                  ...analyticsListContext,
                  rfqId: rfq._id,
                  category: categoryLabel,
                  cardIndex: index,
                  isPremium,
                  isFeatured,
                  sourceAction: 'swipe_detail'
                });
                navigate(`/rfq/${rfq._id}`);
              }}
            >
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
            data-rfq-card="true"
            data-rfq-id={rfq._id}
            data-rfq-index={index}
            data-rfq-category={categoryLabel}
            data-rfq-premium={isPremium ? 'true' : 'false'}
            data-rfq-featured={isFeatured ? 'true' : 'false'}
            onTouchStart={(event) => onCardTouchStart(rfq._id, event)}
            onTouchMove={(event) => onCardTouchMove(rfq._id, event)}
            onTouchEnd={() => onCardTouchEnd(rfq._id)}
            onClick={() => {
              if (isOpened) {
                closeSwipeActions();
                return;
              }

              trackAnalyticsEvent('rfq_card_click', {
                ...analyticsListContext,
                rfqId: rfq._id,
                category: categoryLabel,
                cardIndex: index,
                isPremium,
                isFeatured
              });
              navigate(`/rfq/${rfq._id}`);
            }}
          >
            <RFQDiscoveryCard
              title={rfq.title}
              categoryLabel={categoryLabel}
              locationLabel={formatRfqLocation(rfq)}
              publishedLabel={publishedLabel}
              description={descriptionText}
              distanceLabel={distanceLabel}
              isPremium={isPremium}
              isFeatured={isFeatured}
              isFavorite={isFavorite}
              favoriteAnimating={animating}
              onFavoriteToggle={toggleFavorite}
            />
          </article>
        </div>
      );
    },
    [
      closeSwipeActions,
      currentUserId,
      favorites,
      favoriteAnimating,
      formatDate,
      getBuyerId,
      getCategoryDisplayName,
      handleCloseRFQ,
      isFeaturedRFQ,
      isPremiumRFQ,
      analyticsListContext,
      navigate,
      onCardTouchEnd,
      onCardTouchMove,
      onCardTouchStart,
      swipedCard
    ]
  );

  const activeHomeSection = useMemo(() => {
    const sections = Array.isArray(homeContent.homeSections) ? homeContent.homeSections : [];
    return sections
      .filter((section) => section?.enabled !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))[0] || null;
  }, [homeContent.homeSections]);

  const homeVisualStyle = useMemo(() => {
    if (isWebSurface) {
      return undefined;
    }
    const theme = homeContent.visualTheme || {};
    return {
      '--home-visual-bg': theme.background || '#F5F1EA',
      '--home-card-radius': `${Number(theme.cardRadius || 28)}px`
    };
  }, [homeContent.visualTheme, isWebSurface]);

  return (
    <div
      className={`rfq-list-page ${surfaceVariant === 'web' ? 'rfq-list-page--web' : ''}`}
      style={homeVisualStyle}
      onTouchStart={onPullStart}
      onTouchMove={onPullMove}
      onTouchEnd={onPullEnd}
    >
      <div className="pull-indicator" style={{ height: `${pullDistance}px` }}>
        {pullDistance > 0 ? <span className="spinner" /> : null}
      </div>
      <LoadingOverlay visible={showLoadingOverlay} />

      {error ? (
        <ErrorStateCard
          title="Bağlantı sorunu"
          message="Talepler yüklenemedi. İnterneti kontrol edip tekrar dene."
          onRetry={handleRetry}
          variant={isWebSurface ? 'web' : 'app'}
        />
      ) : null}

      {isWebSurface ? (
        <section className="rfq-web-intro">
          <div className="rfq-web-intro__copy">
            <p className="landing-eyebrow">Website kesif alani</p>
            <h2>Bulundugunuz bolgede acik talepleri web deneyimiyle tarayin.</h2>
            <p>
              Kategori, şehir ve alt filtreleri kullanarak aktif RFQ akışını daha geniş kartlar ve masaüstü
              odakli bir kesif ritmiyle inceleyin.
            </p>
            <div className="rfq-web-intro__actions">
              <button type="button" className="secondary-btn" onClick={handleSelectCity}>
                Şehir Seç
              </button>
              <span className="rfq-web-intro__selected-city">
                {selectedCity?.name ? `Seçili: ${selectedCity.name}` : 'Tüm şehirlerdeki ilanları görüyorsun'}
              </span>
            </div>
          </div>
          <div className="rfq-web-intro__stats">
            <div className="rfq-web-intro__stat">
              <span>Aktif şehir</span>
              <strong>{effectiveSelectedCityLabel}</strong>
            </div>
            <div className="rfq-web-intro__stat">
              <span>Segment</span>
              <strong>{filters.segment ? SEGMENT_OPTIONS.find((item) => item.value === filters.segment)?.label || 'Secili' : 'Tum segmentler'}</strong>
            </div>
            <div className="rfq-web-intro__stat">
              <span>Kapsam</span>
              <strong>{effectiveSelectedKm >= maxRadiusKm ? 'Şehir geneli' : `${effectiveSelectedKm} km`}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {!isWebSurface ? (
        <div className="home-managed-visuals">
          <HomeHeroBanner
            banner={homeContent.heroBanner}
            assetBaseUrl={BACKEND_ORIGIN}
            onNavigate={handleHomeBannerNavigate}
          />
          <HomeQuickCategories
            items={homeContent.quickCategories}
            assetBaseUrl={BACKEND_ORIGIN}
            onSelect={handleHomeQuickCategorySelect}
          />
        </div>
      ) : null}

      <section className={`home-filters ${isWebSurface ? 'home-filters--web' : ''}`}>
        <div className="cats-header-row">
          <div className="cats-inline-wrap">
            <div className="cats-inline-scroll">
              {SEGMENT_OPTIONS.map((segment) => {
                const isActive = String(filters.segment || '') === segment.value;
                return (
                  <button
                    key={segment.value}
                    type="button"
                    className={`cats-inline-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleSegmentSelect(isActive ? '' : segment.value)}
                  >
                    {segment.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="cats-header-row">
          <button
            type="button"
            className="secondary-btn home-filter-btn cats-title-btn"
            onClick={handleOpenCategoryModal}
          >
            {categoryLabel || 'Tüm Kategoriler'}
          </button>
          {categoryLabel ? (
            <button
              type="button"
              className="mini-clear-btn"
              onClick={handleClearCategoryFilter}
              aria-label="Kategori seçimini kaldır"
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
      </section>

      {loading ? <RFQSkeletonGrid count={6} /> : null}

      {!loading ? (
        <section className={`list-section ${isWebSurface ? 'list-section--web' : ''}`}>
          <div className="list-head">
            {homeContent.heroTitle ? (
              <div className="list-hero-title">{homeContent.heroTitle}</div>
            ) : null}
            <div className="list-head-main">
              <h1>{`📍 ${effectiveSelectedCityLabel}`}</h1>
              {!isWebSurface ? (
                <div className="advanced-sort" ref={sortMenuRef}>
                  <button
                    type="button"
                    className="advanced-sort-btn"
                    onClick={() => setIsSortMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isSortMenuOpen}
                  >
                    <span>Gelişmiş Sıralama</span>
                  </button>
                  {isSortMenuOpen ? (
                    <div className="advanced-sort-menu" role="menu" aria-label="Gelişmiş sıralama seçenekleri">
                      {SORT_OPTIONS.map((option) => {
                        const isActive = sortKey === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`advanced-sort-option ${isActive ? 'is-active' : ''}`}
                            onClick={() => handleSortSelect(option.value)}
                            role="menuitemradio"
                            aria-checked={isActive}
                          >
                            <span>{option.label}</span>
                            {isActive ? <strong>Seçili</strong> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {!isWebSurface ? <div className="advanced-sort-current">{activeSortLabel}</div> : null}
            {homeContent.heroSubtitle ? (
              <div className="list-subtitle">{homeContent.heroSubtitle}</div>
            ) : null}
            {!isWebSurface ? (
              <HomeSectionHeader title={activeHomeSection?.title} subtitle={activeHomeSection?.subtitle} />
            ) : null}
          </div>

          {nearbyLoading ? <div className="refresh-text">Yükleniyor...</div> : null}
          {isFiltering ? (
            <div className="filter-loading">
              <span className="spinner" aria-hidden="true" />
              <span>Filtreleniyor...</span>
            </div>
          ) : null}

          {effectiveListIsEmpty && !nearbyLoading ? (
            <EmptyStateCard
              title={effectiveHasCityFilter ? 'Bu şehirde ilan bulunamadı' : uiTexts.emptyCityTitle}
              description={
                effectiveHasCityFilter
                  ? `${effectiveSelectedCityLabel} • ${effectiveSelectedKm >= maxRadiusKm ? 'Şehir geneli' : `${effectiveSelectedKm} km`} için henüz ilan bulunamadı.`
                  : uiTexts.emptyCityDescription
              }
              primaryLabel={effectiveHasCityFilter ? 'Talep oluştur' : 'Şehir seç'}
              secondaryLabel={effectiveHasCityFilter ? 'Km artır' : null}
              onPrimary={effectiveHasCityFilter ? handleCreateRFQ : handleSelectCity}
              onSecondary={effectiveHasCityFilter ? handleIncreaseKm : null}
              variant={isWebSurface ? 'web' : 'app'}
            />
          ) : (
            <div className={`rfq-grid ${isWebSurface ? 'rfq-grid--web' : ''}`}>
              {effectiveListItems.map((rfq, index) => {
                const cardVariant = featuredIds.has(rfq._id)
                  ? 'featured'
                  : isPremiumRFQ(rfq)
                    ? 'premium'
                    : 'normal';
                return renderRFQCard(rfq, index, 0, cardVariant);
              })}
            </div>
          )}
          {loadingMore ? <RFQSkeletonGrid count={2} /> : null}
        </section>
      ) : null}

      {!loading && hasMore ? <div ref={loadMoreRef} className="load-more-sentinel" /> : null}
      {refreshing ? <div className="refresh-text">Yenileniyor...</div> : null}
      {showResultsToast && filters.city ? (
        <div className={`results-toast ${resultsToastVisible ? 'show' : ''}`}>
          📍 <strong>{filters.city}</strong> içinde{' '}
          <span className="results-km">
            {effectiveSelectedKm >= maxRadiusKm ? 'Şehir geneli' : `${effectiveSelectedKm} km`}
          </span>{' '}
          çapındaki talepler gösteriliyor
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}

      {isWebSurface && isCityPickerOpen ? (
        <div className="rfq-city-picker-overlay" onClick={() => setIsCityPickerOpen(false)}>
          <div className="rfq-city-picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="rfq-city-picker-modal__header">
              <div>
                <p className="landing-eyebrow">Web sitesi şehir seçimi</p>
                <h3>Şehir Seç</h3>
              </div>
              <button
                type="button"
                className="mini-clear-btn"
                onClick={() => setIsCityPickerOpen(false)}
                aria-label="Şehir seçim modalını kapat"
              >
                ×
              </button>
            </div>
            <p className="rfq-city-picker-modal__copy">
              Seçtiğin şehir localStorage&apos;a kaydedilir ve ilan listesi bu şehri baz alarak yeniden yüklenir.
            </p>
            <input
              type="text"
              className="city-search-input rfq-city-picker-modal__input"
              placeholder="Şehir ara..."
              value={cityPickerQuery}
              onChange={(event) => setCityPickerQuery(event.target.value)}
              autoFocus
            />
            <div className="rfq-city-picker-modal__actions">
              <button type="button" className="secondary-btn" onClick={() => handleWebsiteCitySelect(null)}>
                Tüm şehirler
              </button>
            </div>
            <div className="rfq-city-picker-modal__list">
              {cityPickerLoading ? <div className="rfq-city-picker-modal__state">Şehirler yükleniyor...</div> : null}
              {!cityPickerLoading && cityPickerError ? (
                <div className="rfq-city-picker-modal__state rfq-city-picker-modal__state--error">{cityPickerError}</div>
              ) : null}
              {!cityPickerLoading && !cityPickerError && cityPickerOptions.length === 0 ? (
                <div className="rfq-city-picker-modal__state">Aramana uygun şehir bulunamadı.</div>
              ) : null}
              {!cityPickerLoading && !cityPickerError
                ? cityPickerOptions.map((city) => {
                    const isActive = String(selectedCity?._id || '') === String(city._id || '');
                    return (
                      <button
                        key={city._id}
                        type="button"
                        className={`rfq-city-picker-modal__option ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleWebsiteCitySelect(city)}
                      >
                        <span>{city.name}</span>
                        {isActive ? <strong>Secili</strong> : null}
                      </button>
                    );
                  })
                : null}
            </div>
          </div>
        </div>
      ) : null}

      <ReusableBottomSheet
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Şehir Seç"
        initialSnap="mid"
        headerRight={(
          <div className="sheet-header-actions">
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
        <div className="home-sheet-filters alert-follow-card">
          <div>
            <div className="alert-follow-title">Bu aramayı takip et</div>
            <div className="alert-follow-sub">
              Yeni ilanlar olduğunda bildirim al.
            </div>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={handleCreateAlert}
            disabled={alertSubmitting}
          >
            {alertSubmitting ? 'Kaydediliyor...' : 'Takip Et'}
          </button>
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
              className="create-sheet-drag-zone"
              onPointerDown={onCreateSheetSurfacePointerDown}
              data-rb-drag-surface="handle"
              role="button"
              aria-label="Sheet sürükleme alanı"
            />
            <RFQCreate />
          </div>
        </div>
      ) : null}

      <CategorySelector
        mode="modal"
        open={isCategoryModalOpen}
        title="Kategoriler"
        selectedSegment={filters.segment || ''}
        onSegmentChange={handleSegmentSelect}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={handleCategorySelect}
        onClear={handleClearCategoryFilter}
        selectedCategoryId={filters.category}
      />
    </div>
  );
}

export default RFQList;
