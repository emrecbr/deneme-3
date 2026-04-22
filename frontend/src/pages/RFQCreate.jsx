import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { getGeoPointErrorMessage, haversineKm, normalizeGeoPointInput, reverseGeocode } from '../utils/geo';

const CategorySelector = lazy(() => import('../components/CategorySelector'));
const MapPicker = lazy(() => import('../components/MapPicker'));
const ReusableBottomSheet = lazy(() => import('../components/ReusableBottomSheet'));

const SEGMENT_OPTIONS = [
  { value: 'goods', label: 'Eşya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

const JOBSEEKER_WORK_TYPES = [
  { value: 'part-time', label: 'Part-time' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'hourly', label: 'Saatlik' },
  { value: 'daily', label: 'Günlük' }
];

const EMPTY_JOBSEEKER_META = {
  workTypes: [],
  availabilityDate: '',
  skills: '',
  shortNote: '',
  expectedPay: ''
};

function RFQCreate({ mode = 'create', initialData = null, onSuccess, onClose, surfaceVariant = 'app' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWebSurface = surfaceVariant === 'web';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
    segment: '',
    categoryId: '',
    city: '',
    district: '',
    neighborhood: '',
    street: '',
    quantity: '',
    targetPrice: '',
    deadline: '',
    isAuction: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [toast, setToast] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [images, setImages] = useState([]);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [priceValue, setPriceValue] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [monetizationPlans, setMonetizationPlans] = useState([]);
  const [cityQuery, setCityQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const [streetQuery, setStreetQuery] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState([]);
  const [streetOptions, setStreetOptions] = useState([]);
  const [locationIds, setLocationIds] = useState({
    cityId: '',
    districtId: '',
    neighborhoodId: ''
  });
  const [carBrand, setCarBrand] = useState(null);
  const [carModel, setCarModel] = useState(null);
  const [carVariant, setCarVariant] = useState(null);
  const [carYear, setCarYear] = useState('');
  const [carBrandQuery, setCarBrandQuery] = useState('');
  const [carModelQuery, setCarModelQuery] = useState('');
  const [carVariantQuery, setCarVariantQuery] = useState('');
  const [carBrands, setCarBrands] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [carVariants, setCarVariants] = useState([]);
  const [carBrandSheetOpen, setCarBrandSheetOpen] = useState(false);
  const [carModelSheetOpen, setCarModelSheetOpen] = useState(false);
  const [carVariantSheetOpen, setCarVariantSheetOpen] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState('');
  const [extraPaymentLoading, setExtraPaymentLoading] = useState(false);
  const [jobseekerMeta, setJobseekerMeta] = useState(EMPTY_JOBSEEKER_META);
  const stepLabels = ['Temel bilgi', 'Detaylar', 'Konum', 'Yayin'];
  const isEdit = mode === 'edit';
  const premiumActive = Boolean(
    user?.isPremium && (!user?.premiumUntil || new Date(user.premiumUntil) > new Date())
  );
  const premiumPlan = useMemo(
    () => monetizationPlans.find((plan) => plan.key === 'premium_listing') || null,
    [monetizationPlans]
  );
  const featuredPlan = useMemo(
    () => monetizationPlans.find((plan) => plan.key === 'featured_listing') || null,
    [monetizationPlans]
  );
  const premiumMonthlyCode = premiumPlan?.metadata?.planCodes?.monthly || 'premium_monthly';
  const premiumYearlyCode = premiumPlan?.metadata?.planCodes?.yearly || 'premium_yearly';
  const featuredMonthlyCode = featuredPlan?.metadata?.planCodes?.monthly || 'featured_monthly';
  const featuredYearlyCode = featuredPlan?.metadata?.planCodes?.yearly || 'featured_yearly';
  const premiumModes = premiumPlan?.billingModes || ['monthly', 'yearly'];
  const featuredModes = featuredPlan?.billingModes || ['monthly', 'yearly'];
  const hasUnsavedChanges = useMemo(() => {
    return Boolean(
      form.title ||
      form.description ||
      form.categoryId ||
      form.city ||
      form.district ||
      form.neighborhood ||
      form.street ||
      form.quantity ||
      form.deadline ||
      form.isAuction ||
      images.length ||
      priceText
    );
  }, [form, images.length, priceText]);
  const isCarCategory = useMemo(() => form.segment === 'auto', [form.segment]);
  const isJobseekerSegment = useMemo(() => form.segment === 'jobseeker', [form.segment]);
  const buildGeoPoint = useCallback((value) => normalizeGeoPointInput(value).point, []);
  const getLocationValidationMessage = useCallback((value) => getGeoPointErrorMessage(value), []);

  useEffect(() => {
    if (!isEdit || !initialData) {
      return;
    }
    setForm({
      title: initialData.title || '',
      description: initialData.description || '',
      segment: String(initialData?.segment || initialData?.category?.segment || ''),
      categoryId: String(initialData?.category?._id || initialData?.category || ''),
      city: String(initialData?.locationData?.city || initialData?.city?.name || ''),
      district: String(initialData?.locationData?.district || initialData?.district?.name || ''),
      neighborhood: String(initialData?.locationData?.neighborhood || initialData?.neighborhood || ''),
      street: String(initialData?.locationData?.street || initialData?.street || ''),
      quantity: String(initialData?.quantity || ''),
      targetPrice: String(initialData?.targetPrice || ''),
      deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().slice(0, 10) : '',
      isAuction: Boolean(initialData?.isAuction)
    });
    setLocationIds({
      cityId: String(initialData?.city?._id || initialData?.city || ''),
      districtId: String(initialData?.district?._id || initialData?.district || ''),
      neighborhoodId: ''
    });
    if (initialData?.category?.name) {
      setSelectedCategoryLabel(initialData.category.name);
    }
    if (initialData?.targetPrice != null) {
      const numericPrice = Number(initialData.targetPrice);
      if (Number.isFinite(numericPrice)) {
        setPriceValue(numericPrice);
        setPriceText(numericPrice.toLocaleString('tr-TR'));
      }
    }
    if (initialData?.location?.coordinates?.length === 2) {
      const [lng, lat] = initialData.location.coordinates;
      if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        setSelectedLocation({ lat: Number(lat), lng: Number(lng) });
      }
    }
    if (initialData?.car) {
      setCarBrand(
        initialData.car.brandId && initialData.car.brandName
          ? { _id: initialData.car.brandId, name: initialData.car.brandName }
          : null
      );
      setCarModel(
        initialData.car.modelId && initialData.car.modelName
          ? { _id: initialData.car.modelId, name: initialData.car.modelName }
          : null
      );
      setCarVariant(
        initialData.car.variantId && initialData.car.variantName
          ? { _id: initialData.car.variantId, name: initialData.car.variantName }
          : null
      );
      if (initialData.car.year) {
        setCarYear(String(initialData.car.year));
      }
    }
    setJobseekerMeta({
      workTypes: Array.isArray(initialData?.segmentMetadata?.workTypes)
        ? initialData.segmentMetadata.workTypes.filter(Boolean)
        : [],
      availabilityDate: String(initialData?.segmentMetadata?.availabilityDate || ''),
      skills: Array.isArray(initialData?.segmentMetadata?.skills)
        ? initialData.segmentMetadata.skills.join(', ')
        : String(initialData?.segmentMetadata?.skills || ''),
      shortNote: String(initialData?.segmentMetadata?.shortNote || ''),
      expectedPay: String(initialData?.segmentMetadata?.expectedPay || '')
    });
  }, [initialData, isEdit]);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await api.get('/app/monetization/plans');
        setMonetizationPlans(response.data?.items || []);
      } catch (_error) {
        setMonetizationPlans([]);
      }
    };
    loadPlans();
  }, []);

  useEffect(() => {
    if (isEdit) {
      return;
    }
    let active = true;
    const loadQuota = async () => {
      try {
        setQuotaLoading(true);
        const res = await api.get('/users/me/listing-quota');
        if (!active) return;
        setQuotaInfo(res.data?.data || null);
        setQuotaError('');
      } catch (err) {
        if (!active) return;
        setQuotaError(err?.response?.data?.message || 'Kota bilgisi alınamadı.');
      } finally {
        if (active) setQuotaLoading(false);
      }
    };
    loadQuota();
    return () => {
      active = false;
    };
  }, [isEdit]);

  const normalizeOption = (item) => {
    if (typeof item === 'string') {
      return { id: item, name: item, type: undefined };
    }
    return {
      id: String(item?._id || item?.id || item?.name || ''),
      name: String(item?.name || item?.value || ''),
      type: item?.type
    };
  };

  const findOptionByName = (items, value) => {
    const normalizedValue = String(value || '').trim().toLocaleLowerCase('tr-TR');
    return items.find((item) => item.name.toLocaleLowerCase('tr-TR') === normalizedValue) || null;
  };

  useEffect(() => {
    const normalizedLocation = normalizeGeoPointInput(selectedLocation);
    if (normalizedLocation.point) {
      setLatitude(normalizedLocation.lat);
      setLongitude(normalizedLocation.lng);
      setLocationError('');
      return;
    }
    setLatitude(null);
    setLongitude(null);
  }, [selectedLocation]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await api.get('/location/cities', {
          params: { search: cityQuery, limit: 100, page: 1 }
        });
        setCityOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setCityOptions([]);
      }
    };

    fetchCities();
  }, [cityQuery]);

  useEffect(() => {
    if (!isCarCategory) {
      return;
    }
    const fetchBrands = async () => {
      try {
        const response = await api.get('/cars/brands', {
          params: { search: carBrandQuery, limit: 50, page: 1 }
        });
        setCarBrands(response.data?.data || []);
      } catch (_error) {
        setCarBrands([]);
      }
    };
    fetchBrands();
  }, [carBrandQuery, isCarCategory]);

  useEffect(() => {
    if (!carBrand?._id) {
      setCarModels([]);
      return;
    }
    const fetchModels = async () => {
      try {
        const response = await api.get('/cars/models', {
          params: { brandId: carBrand._id, search: carModelQuery, limit: 50, page: 1 }
        });
        setCarModels(response.data?.data || []);
      } catch (_error) {
        setCarModels([]);
      }
    };
    fetchModels();
  }, [carBrand?._id, carModelQuery]);

  useEffect(() => {
    if (!carModel?._id) {
      setCarVariants([]);
      return;
    }
    const fetchVariants = async () => {
      try {
        const response = await api.get('/cars/variants', {
          params: {
            modelId: carModel._id,
            search: carVariantQuery,
            ...(carYear ? { year: carYear } : {}),
            limit: 50,
            page: 1
          }
        });
        setCarVariants(response.data?.data || []);
      } catch (_error) {
        setCarVariants([]);
      }
    };
    fetchVariants();
  }, [carModel?._id, carVariantQuery, carYear]);

  useEffect(() => {
    const fetchDistricts = async () => {
      if (!form.city) {
        setDistrictOptions([]);
        return;
      }
      try {
        const response = await api.get('/location/districts', {
          params: {
            ...(locationIds.cityId ? { cityId: locationIds.cityId } : { city: form.city }),
            search: districtQuery,
            limit: 100,
            page: 1
          }
        });
        setDistrictOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setDistrictOptions([]);
      }
    };

    fetchDistricts();
  }, [districtQuery, form.city, locationIds.cityId]);

  useEffect(() => {
    const fetchNeighborhoods = async () => {
      if (!form.city || !form.district) {
        setNeighborhoodOptions([]);
        return;
      }
      try {
        const response = await api.get('/location/neighborhoods', {
          params: {
            ...(locationIds.districtId
              ? { districtId: locationIds.districtId }
              : { city: form.city, district: form.district }),
            search: neighborhoodQuery,
            limit: 100,
            page: 1
          }
        });
        setNeighborhoodOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setNeighborhoodOptions([]);
      }
    };

    fetchNeighborhoods();
  }, [form.city, form.district, locationIds.districtId, neighborhoodQuery]);

  useEffect(() => {
    const fetchStreets = async () => {
      if (!form.city || !form.district || !form.neighborhood) {
        setStreetOptions([]);
        return;
      }
      try {
        const response = await api.get('/location/streets', {
          params: {
            ...(locationIds.neighborhoodId
              ? { neighborhoodId: locationIds.neighborhoodId }
              : { city: form.city, district: form.district, neighborhood: form.neighborhood }),
            search: streetQuery,
            limit: 100,
            page: 1
          }
        });
        setStreetOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setStreetOptions([]);
      }
    };

    fetchStreets();
  }, [form.city, form.district, form.neighborhood, streetQuery]);

  const requestCurrentLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) {
        setLocationError('Konum alinmadi, cihaz desteklemiyor.');
      }
      return;
    }
    setLocating(true);
    setLocationError('');
    setLocationHint('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const normalizedLocation = normalizeGeoPointInput({ lat, lng });
        if (!normalizedLocation.point) {
          setLocationError(getLocationValidationMessage({ lat, lng }));
          setLocating(false);
          return;
        }
        setSelectedLocation({ lat: normalizedLocation.lat, lng: normalizedLocation.lng });

        const resolveName = (value) => {
          if (!value) return '';
          if (typeof value === 'string') return value;
          return value.name || value.label || value.title || '';
        };

        const resolveNearestCity = async () => {
          try {
            let page = 1;
            let hasMore = true;
            let nearest = null;
            let nearestDistance = Number.POSITIVE_INFINITY;

            while (hasMore && page <= 10) {
              const response = await api.get('/location/cities', {
                params: { page, limit: 200, includeCoords: true }
              });
              const items = response.data?.items || response.data?.data || [];
              items.forEach((city) => {
                const coords = city?.center?.coordinates || city?.location?.coordinates || null;
                const latVal = Array.isArray(coords) ? Number(coords[1]) : Number(city?.lat);
                const lngVal = Array.isArray(coords) ? Number(coords[0]) : Number(city?.lng);
                if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) {
                  return;
                }
                const distance = haversineKm({ lat, lng }, { lat: latVal, lng: lngVal });
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearest = {
                    _id: city._id || city.id || '',
                    name: city.name || ''
                  };
                }
              });
              hasMore = Boolean(response.data?.hasMore);
              page += 1;
            }

            return nearest?.name ? nearest : null;
          } catch (_error) {
            return null;
          }
        };

        try {
          const reverseResponse = await reverseGeocode({ lat, lng });
          const payload = reverseResponse.data || {};
          const cityCandidates = [
            resolveName(payload.city),
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
          const districtCandidates = [
            resolveName(payload.district),
            resolveName(payload.town),
            resolveName(payload.municipality),
            resolveName(payload.county),
            payload.districtName,
            payload.ilce
          ].filter(Boolean);

          let cityName = cityCandidates[0] || '';
          let districtName = districtCandidates[0] || '';

          if (!cityName) {
            const nearestCity = await resolveNearestCity();
            if (nearestCity?.name) {
              cityName = nearestCity.name;
              districtName = '';
              setLocationHint('Konumuna en yakin sehir secildi. Ilceyi istersen manuel netlestirebilirsin.');
            }
          }

          if (cityName) {
            setForm((prev) => ({
              ...prev,
              city: cityName
            }));
            setCityQuery(cityName);
            const cityRes = await api.get('/location/search', { params: { q: cityName } });
            const cityItems = Array.isArray(cityRes.data?.data)
              ? cityRes.data.data
              : Array.isArray(cityRes.data?.items)
                ? cityRes.data.items
                : Array.isArray(cityRes.data)
                  ? cityRes.data
                  : [];
            const match = cityItems.find((item) => item?.name?.toLowerCase() === cityName.toLowerCase());
            const fallbackCity = match || cityItems[0];
            const cityId = fallbackCity?._id || fallbackCity?.id || '';
            setLocationIds((prev) => ({
              ...prev,
              cityId,
              districtId: '',
              neighborhoodId: ''
            }));
            if (cityItems.length) {
              setCityOptions(cityItems.map(normalizeOption));
            }
            if (districtName && cityId) {
              setForm((prev) => ({
                ...prev,
                district: districtName,
                neighborhood: '',
                street: ''
              }));
              setDistrictQuery(districtName);
              const districtRes = await api.get('/location/districts', {
                params: { cityId, q: districtName, page: 1, limit: 200 }
              });
              const districtItems = (districtRes.data?.data || districtRes.data?.items || []).map(normalizeOption);
              const matchDistrict = districtItems.find(
                (item) => item.name?.toLowerCase() === districtName.toLowerCase()
              );
              const districtId = matchDistrict?.id || districtItems[0]?.id || '';
              setLocationIds((prev) => ({
                ...prev,
                cityId,
                districtId,
                neighborhoodId: ''
              }));
              if (districtItems.length) {
                setDistrictOptions(districtItems);
              }
              setLocationHint('Konum bilgisi otomatik dolduruldu. Haritadaki pini istersen yeniden konumlandirabilirsin.');
            } else {
              setForm((prev) => ({
                ...prev,
                district: '',
                neighborhood: '',
                street: ''
              }));
              setDistrictOptions([]);
              setNeighborhoodOptions([]);
              setStreetOptions([]);
              setLocationHint('Sehir bulundu. Ilceyi manuel secerek devam edebilirsin.');
            }
          } else if (!silent) {
            setLocationError('Konum alındı. Şehir bilgisi çözümlenemedi, lütfen şehir seçin.');
          }
        } catch (_error) {
          const nearestCity = await resolveNearestCity();
          if (nearestCity?.name) {
            setForm((prev) => ({
              ...prev,
              city: nearestCity.name,
              district: '',
              neighborhood: '',
              street: ''
            }));
            setCityQuery(nearestCity.name);
            setLocationIds({
              cityId: nearestCity._id || '',
              districtId: '',
              neighborhoodId: ''
            });
            setDistrictOptions([]);
            setNeighborhoodOptions([]);
            setStreetOptions([]);
            setLocationHint('Konum bulundu. En yakin sehir secildi, ilceyi manuel tamamlayabilirsin.');
            if (!silent) {
              setLocationError('Konum alındı. İlçe bulunamadı, istersen manuel seçim yapabilirsin.');
            }
          } else if (!silent) {
            setLocationError('Konum alındı ancak şehir bilgisi bulunamadı, lütfen manuel seçin.');
          }
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        if (!silent) {
          if (error?.code === 1) {
            setLocationError('Konum izni verilmedi');
          } else {
        setLocationError('Konum alınamadı, tekrar dene');
          }
        }
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  useEffect(() => {
    if (isEdit) {
      return;
    }
    const historyState = window.history?.state?.usr || null;
    const fromState = historyState;
    const fromStorageRaw = sessionStorage.getItem('selectedCategory');
    let fromStorage = null;
    if (fromStorageRaw) {
      try {
        fromStorage = JSON.parse(fromStorageRaw);
      } catch (_error) {
        fromStorage = null;
      }
    }
    const selected = fromState?.selectedCategoryId ? fromState : fromStorage;

    if (selected?.selectedCategoryId) {
      setForm((prev) => ({
        ...prev,
        segment: String(selected.selectedSegment || prev.segment || ''),
        categoryId: String(selected.selectedCategoryId)
      }));
      if (Array.isArray(selected.selectedCategoryPath) && selected.selectedCategoryPath.length > 0) {
        setSelectedCategoryLabel(selected.selectedCategoryPath.join(' > '));
      }
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStepError('');
  }, [step]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePriceChange = (event) => {
    const raw = String(event.target.value || '');
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) {
      setPriceText('');
      setPriceValue(null);
      setForm((prev) => ({ ...prev, targetPrice: '' }));
      return;
    }
    const nextValue = Number(digits);
    const capped = Math.min(nextValue, 999999999);
    setPriceValue(capped);
    setPriceText(capped.toLocaleString('tr-TR'));
    setForm((prev) => ({ ...prev, targetPrice: String(capped) }));
  };

  const handleCityChange = (event) => {
    const city = event.target.value;
    setLocationError('');
    setLocationHint('');
    setForm((prev) => ({
      ...prev,
      city,
      district: '',
      neighborhood: '',
      street: ''
    }));
    const selectedCity = findOptionByName(cityOptions, city);
    setLocationIds({
      cityId: selectedCity?.id || '',
      districtId: '',
      neighborhoodId: ''
    });
    setDistrictQuery('');
    setNeighborhoodQuery('');
    setStreetQuery('');
  };

  const showToast = (message) => {
    if (!message) {
      return;
    }
    setToast(message);
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      setToast('');
    }, 2500);
  };

  const logFlowEvent = useCallback(async (payload) => {
    try {
      await api.post('/rfq-flow/event', payload);
    } catch (_error) {
      // ignore analytics errors
    }
  }, []);

  useEffect(() => {
    logFlowEvent({ step, event: 'step_view' });
  }, [logFlowEvent, step]);

  const toggleJobseekerWorkType = useCallback((value) => {
    setJobseekerMeta((prev) => ({
      ...prev,
      workTypes: prev.workTypes.includes(value)
        ? prev.workTypes.filter((item) => item !== value)
        : [...prev.workTypes, value]
    }));
  }, []);

  const buildJobseekerMetadata = useCallback(() => {
    const normalizedSkills = String(jobseekerMeta.skills || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      workTypes: jobseekerMeta.workTypes,
      availabilityDate: jobseekerMeta.availabilityDate || undefined,
      skills: normalizedSkills,
      shortNote: String(jobseekerMeta.shortNote || '').trim() || undefined,
      expectedPay: String(jobseekerMeta.expectedPay || '').trim() || undefined
    };
  }, [jobseekerMeta]);

  const getStepErrorDetail = (currentStep) => {
    if (currentStep === 1) {
      if (!form.segment) {
        return { message: 'Segment seç', field: 'segment' };
      }
      if (form.title.trim().length < 3) {
        return { message: 'Başlık en az 3 karakter olmalı', field: 'title' };
      }
      if (!form.categoryId) {
        return { message: 'Kategori seç', field: 'categoryId' };
      }
      if (form.description.trim().length < 10) {
        return { message: 'Açıklama en az 10 karakter olmalı', field: 'description' };
      }
      return { message: '', field: '' };
    }

    if (currentStep === 2) {
      if (isCarCategory && (!carBrand || !carModel)) {
        return { message: 'Marka ve model seç', field: 'carBrand' };
      }
      if (isJobseekerSegment && jobseekerMeta.workTypes.length === 0) {
        return { message: 'Çalışma tipi seç', field: 'workTypes' };
      }
      if (isJobseekerSegment && !jobseekerMeta.availabilityDate) {
        return { message: 'Müsaitlik tarihi seç', field: 'availabilityDate' };
      }
      const quantityValue = Number(form.quantity);
      if (!isJobseekerSegment && (!Number.isFinite(quantityValue) || quantityValue < 1)) {
        return { message: 'Adet en az 1 olmalı', field: 'quantity' };
      }
      const hasPriceInput = priceText.trim().length > 0 || Number.isFinite(priceValue);
      if (hasPriceInput && (!Number.isFinite(priceValue) || priceValue <= 0)) {
        return { message: 'Hedef fiyat gir', field: 'targetPrice' };
      }
      if (!isJobseekerSegment && !form.deadline) {
        return { message: 'Teslim süresi seç', field: 'deadline' };
      }
      const deadlineValue = new Date(
        isJobseekerSegment ? jobseekerMeta.availabilityDate : form.deadline
      ).getTime();
      if (!Number.isFinite(deadlineValue) || deadlineValue <= Date.now()) {
        return {
          message: isJobseekerSegment ? 'Müsaitlik tarihi gelecekte olmalı' : 'Teslim süresi gelecekte olmalı',
          field: isJobseekerSegment ? 'availabilityDate' : 'deadline'
        };
      }
      return { message: '', field: '' };
    }

    if (currentStep === 3) {
      if (!form.city) {
        return { message: 'Şehir seç', field: 'city' };
      }
      if (!form.district) {
        return { message: 'İlçe seç', field: 'district' };
      }
      if (!buildGeoPoint(selectedLocation)) {
        return { message: getLocationValidationMessage(selectedLocation), field: 'location' };
      }
      return { message: '', field: '' };
    }

    return { message: '', field: '' };
  };

  const getStepError = (currentStep) => {
    return getStepErrorDetail(currentStep).message;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (step !== 4) {
      showToast('Lütfen adımları tamamla');
      return;
    }
    const validationDetail = getStepErrorDetail(3);
    if (validationDetail.message) {
      setStepError(validationDetail.message);
      showToast(validationDetail.message);
      logFlowEvent({ step: 3, event: 'step_blocked', field: validationDetail.field, error: validationDetail.message });
      return;
    }
    setError('');
    setStepError('');
    console.log('RFQ_CREATE_START');
    setLoading(true);

    try {
      const geoPoint = buildGeoPoint(selectedLocation);
      if (!geoPoint) {
        setError(getLocationValidationMessage(selectedLocation));
        setLoading(false);
        return;
      }
      if (isEdit && initialData?._id) {
        const payload = {
          title: form.title,
          description: form.description,
          segment: form.segment,
          categoryId: form.categoryId,
          cityId: locationIds.cityId || undefined,
          districtId: locationIds.districtId || undefined,
          neighborhood: form.neighborhood,
          street: form.street,
          quantity: Number(form.quantity),
          deadline: form.deadline,
          targetPrice: Number.isFinite(priceValue) ? priceValue : undefined,
          location: geoPoint,
          isAuction: Boolean(form.isAuction)
        };
        if (isJobseekerSegment) {
          payload.quantity = 1;
          payload.segmentMetadata = buildJobseekerMetadata();
        }
        if (isCarCategory && carBrand && carModel) {
          payload.car = {
            brandId: carBrand?._id,
            modelId: carModel?._id,
            variantId: carVariant?._id || undefined,
            year: carYear || undefined,
            brandName: carBrand?.name,
            modelName: carModel?.name,
            variantName: carVariant?.name || undefined
          };
        }
        const response = await api.patch(`/rfq/${initialData._id}`, payload);
        if (onSuccess) {
          onSuccess(response.data?.data || null);
        }
        if (onClose) {
          onClose();
        }
      } else {
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('description', form.description);
        formData.append('segment', form.segment);
        formData.append('categoryId', form.categoryId);
        formData.append('city', form.city);
        formData.append('district', form.district);
        formData.append('neighborhood', form.neighborhood);
        formData.append('street', form.street);
        formData.append('quantity', String(isJobseekerSegment ? 1 : Number(form.quantity)));
        formData.append('deadline', isJobseekerSegment ? jobseekerMeta.availabilityDate : form.deadline);
        formData.append('isAuction', String(Boolean(form.isAuction)));
        if (!form.deadline) {
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
          formData.append('expiresAt', expiresAt);
        }
        formData.append('location', JSON.stringify(geoPoint));
        formData.append('latitude', String(geoPoint.coordinates[1]));
        formData.append('longitude', String(geoPoint.coordinates[0]));

    if (Number.isFinite(priceValue)) {
      formData.append('targetPrice', String(priceValue));
    }

    if (isJobseekerSegment) {
      formData.append('segmentMetadata', JSON.stringify(buildJobseekerMetadata()));
    }

    if (isCarCategory && carBrand && carModel) {
      formData.append(
        'car',
        JSON.stringify({
          brandId: carBrand?._id,
          modelId: carModel?._id,
          variantId: carVariant?._id || undefined,
          year: carYear || undefined,
          brandName: carBrand?.name,
          modelName: carModel?.name,
          variantName: carVariant?.name || undefined
        })
      );
    }

        for (let index = 0; index < images.length; index += 1) {
          formData.append('images', images[index]);
        }

        const response = await api.post('/rfq', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        const created = response.data?.data || response.data;
        const createdId = created?._id || created?.id;
        console.log('RFQ_CREATE_OK', { id: createdId });
        logFlowEvent({ step: 4, event: 'step_complete' });

        setForm({
          title: '',
          description: '',
          segment: '',
          categoryId: '',
          city: '',
          district: '',
          neighborhood: '',
          street: '',
          quantity: '',
          targetPrice: '',
          deadline: '',
          isAuction: false
        });
        setPriceText('');
        setPriceValue(null);
        setSelectedLocation(null);
        setLocationError('');
        setLocationHint('');
        setStep(1);
        setImages([]);
        setCarBrand(null);
        setCarModel(null);
        setCarVariant(null);
        setCarYear('');
        setJobseekerMeta(EMPTY_JOBSEEKER_META);
        setCityQuery('');
        setDistrictQuery('');
        setNeighborhoodQuery('');
        setStreetQuery('');
        setCityOptions([]);
        setDistrictOptions([]);
        setNeighborhoodOptions([]);
        setStreetOptions([]);
        setLocationIds({ cityId: '', districtId: '', neighborhoodId: '' });
        setSelectedCategoryLabel('');
        setError('');
        setStepError('');
        if (onSuccess) {
          onSuccess(created || null);
        }
        showToast('Talep yayınlandı');
        if (onClose) {
          onClose();
        }
        if (createdId) {
          navigate(`/rfq/${createdId}`);
        }
      }
    } catch (submitError) {
      const status = submitError?.response?.status;
      const code = submitError?.response?.data?.code;
      const message = submitError?.response?.data?.message;
      console.error('RFQ_CREATE_FAIL', { status, code, message });
      if (!submitError?.response) {
        setError('Sunucuya bağlanılamadı');
        showToast('Sunucuya bağlanılamadı');
      } else if (status === 402 && code === 'LISTING_QUOTA_REACHED') {
        logFlowEvent({
          step: 4,
          event: 'paywall_shown',
          reason: 'listing_quota_reached'
        });
        setError(message || 'Ücretsiz ilan hakkınız doldu.');
        showToast(message || 'Ücretsiz ilan hakkınız doldu.');
        if (submitError?.response?.data?.data) {
          setQuotaInfo(submitError.response.data.data);
        }
      } else if (status === 422 && code === 'MODERATION_REVIEW') {
        setError(message || 'İçeriğiniz incelemeye alındı.');
        showToast(message || 'İçeriğiniz incelemeye alındı.');
      } else if (status === 400 || status === 422) {
        setError(message || 'Geçersiz bilgi');
        showToast(message || 'Geçersiz bilgi');
      } else if (status >= 500) {
        setError('Sunucu hatası, tekrar dene');
        showToast('Sunucu hatası, tekrar dene');
      } else {
        setError(message || (isEdit ? 'Talep güncellenemedi.' : 'Talep oluşturulamadı.'));
        showToast(message || (isEdit ? 'Talep güncellenemedi.' : 'Talep oluşturulamadı.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Çıkmak istiyor musun?');
      if (!confirmed) {
        return;
      }
    }
    if (onClose) {
      onClose();
      return;
    }
    navigate(-1);
  };

  const handleCategorySelect = (category) => {
    setForm((prev) => ({
      ...prev,
      segment: String(category.segment || prev.segment || ''),
      categoryId: String(category._id)
    }));
    setSelectedCategoryLabel(Array.isArray(category.path) ? category.path.join(' > ') : category.name || '');
    setCarBrand(null);
    setCarModel(null);
    setCarVariant(null);
    setCarYear('');
    setIsCategoryModalOpen(false);
  };

  const handleClearCategory = () => {
    setForm((prev) => ({
      ...prev,
      categoryId: ''
    }));
    setSelectedCategoryLabel('');
    setCarBrand(null);
    setCarModel(null);
    setCarVariant(null);
    setCarYear('');
    setIsCategoryModalOpen(false);
  };

  const handleSegmentSelect = (segment) => {
    setForm((prev) => ({
      ...prev,
      segment,
      categoryId: '',
      quantity: segment === 'jobseeker' ? '' : prev.quantity,
      targetPrice: segment === 'jobseeker' ? '' : prev.targetPrice,
      deadline: segment === 'jobseeker' ? '' : prev.deadline
    }));
    setSelectedCategoryLabel('');
    setCarBrand(null);
    setCarModel(null);
    setCarVariant(null);
    setCarYear('');
    setJobseekerMeta((prev) => (segment === 'jobseeker' ? prev : EMPTY_JOBSEEKER_META));
    if (segment === 'jobseeker') {
      setPriceText('');
      setPriceValue(null);
    }
  };

  const step1Error = getStepError(1);
  const step2Error = getStepError(2);
  const step3Error = getStepError(3);
  const canContinueStep1 = step1Error === '';
  const canContinueStep2 = step2Error === '';
  const canContinueStep3 = step3Error === '';
  const showStep1Errors = Boolean(stepError) || Boolean(form.title || form.description || form.categoryId || form.segment);
  const step1FieldErrors = {
    title: form.title.trim().length >= 3 ? '' : 'Başlık en az 3 karakter olmalı',
    categoryId: form.categoryId ? '' : 'Kategori seç',
    description: form.description.trim().length >= 10 ? '' : 'Açıklama en az 10 karakter olmalı'
  };

  const handleCheckout = async (planCode) => {
    const hasStoredToken = Boolean(localStorage.getItem('token'));
    try {
      console.info('PREMIUM_CHECKOUT_START', {
        source: 'rfq_create_paywall',
        planCode,
        hasUser: Boolean(user),
        hasStoredToken
      });
      logFlowEvent({
        step: 4,
        event: 'plan_checkout_started',
        planCode
      });
      setCheckoutLoading(planCode);
      console.info('PREMIUM_CHECKOUT_REQUEST', {
        source: 'rfq_create_paywall',
        endpoint: '/billing/checkout',
        planCode
      });
      const response = await api.post('/billing/checkout', { planCode }, buildProtectedRequestConfig());
      const url = response.data?.checkoutUrl;
      console.info('PREMIUM_CHECKOUT_RESPONSE', {
        source: 'rfq_create_paywall',
        planCode,
        status: response.status,
        hasCheckoutUrl: Boolean(url)
      });
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar dene; sorun sürerse yeniden giriş yap.'
          : requestError.response?.data?.message || 'Ödeme başlatılamadı.';
      if (status === 401 || status === 403) {
        console.warn('PREMIUM_AUTH_MISSING', {
          source: 'rfq_create_paywall',
          planCode,
          status,
          hasUser: Boolean(user),
          hasStoredToken
        });
      }
      console.warn('PREMIUM_CHECKOUT_FAILURE', {
        source: 'rfq_create_paywall',
        planCode,
        status: status || null,
        reason: status === 401 || status === 403 ? 'auth_failed' : 'payment_init_failed',
        hasUser: Boolean(user),
        hasStoredToken
      });
      setError(message);
      showToast(message);
    } finally {
      setCheckoutLoading('');
    }
  };

  const handleExtraListingPayment = async () => {
    try {
      logFlowEvent({
        step: 4,
        event: 'listing_extra_checkout_started'
      });
      setExtraPaymentLoading(true);
      const response = await api.post('/billing/listing-extra/checkout', {}, buildProtectedRequestConfig());
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar dene; sorun sürerse yeniden giriş yap.'
          : requestError.response?.data?.message || 'Ödeme başlatılamadı.';
      setError(message);
      showToast(message);
    } finally {
      setExtraPaymentLoading(false);
    }
  };

  return (
    <div className={`page ${isWebSurface ? 'rfq-create-page--web' : ''}`}>
      <div className={`card ${isWebSurface ? 'rfq-create-card--web' : ''}`}>
        <button type="button" className="icon-btn back-icon" onClick={handleBack} aria-label="Geri">
          ←
        </button>
        {isWebSurface ? (
          <div className="rfq-create-hero">
            <div className="rfq-create-hero__copy">
              <p className="landing-eyebrow">Website talep olusturma</p>
              <h1>{isEdit ? 'Talebini website uzerinden duzenle' : 'Yeni talebini web akisi ile hazirla'}</h1>
              <p>
                Kategori, ihtiyac detaylari ve konum bilgisini daha genis bir form alaninda tamamla. App hostuna
                gecmeden once talebini website uzerinden netlestirebilirsin.
              </p>
            </div>
            <div className="rfq-create-hero__aside">
              <div className="rfq-create-hero__aside-card">
                <span>Adim</span>
                <strong>{step} / 4</strong>
              </div>
              <div className="rfq-create-hero__aside-card">
                <span>Surface</span>
                <strong>Website / web-first</strong>
              </div>
              <div className="rfq-create-hero__aside-card">
                <span>Akis</span>
                <strong>Kategori, detay, konum, yayin</strong>
              </div>
            </div>
          </div>
        ) : (
          <h1>{isEdit ? 'Talep Düzenle' : 'Yeni RFQ Oluştur'}</h1>
        )}
        <div className="wizard-progress" aria-label="Adım ilerleme">
          {[1, 2, 3, 4].map((dot) => (
            <span key={dot} className={`wizard-dot ${step === dot ? 'active' : ''}`} />
          ))}
        </div>
        {isWebSurface ? (
          <div className="rfq-create-stepbar" aria-label="Form baglami">
            {stepLabels.map((label, index) => (
              <div
                key={label}
                className={`rfq-create-stepbar__item ${step === index + 1 ? 'is-active' : ''} ${step > index + 1 ? 'is-complete' : ''}`}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {!isEdit ? (
          <div className="quota-card">
            {quotaLoading ? (
              <div className="quota-muted">Kota bilgisi yükleniyor...</div>
            ) : quotaError ? (
              <div className="quota-error">{quotaError}</div>
            ) : quotaInfo ? (
              <>
                <div className="quota-row">
                  <strong>Kalan ücretsiz ilan hakkı:</strong>
                  <span>
                    {quotaInfo.remainingFree}/{quotaInfo.maxFree}
                  </span>
                </div>
                <div className="quota-row">
                  <span>Bu dönem bitiş:</span>
                  <span>{quotaInfo.windowEnd ? new Date(quotaInfo.windowEnd).toLocaleDateString('tr-TR') : 'İlk ilanla başlar'}</span>
                </div>
                {quotaInfo.remainingFree === 0 ? (
                  <div className="quota-alert">
                    <div>Bu dönem için ücretsiz ilan hakkınız doldu.</div>
                    {quotaInfo.extraEnabled ? (
                      <div className="quota-pay">
                        <span>Ek ilan ücreti: {quotaInfo.extraPrice} {quotaInfo.currency}</span>
                        <button type="button" className="secondary-btn" onClick={handleExtraListingPayment} disabled={extraPaymentLoading}>
                          {extraPaymentLoading ? 'Ödeme başlatılıyor...' : 'Ek ilan için ödeme yap'}
                        </button>
                      </div>
                    ) : (
                      <div>Ek ilan özelliği şu an kapalı.</div>
                    )}
                  </div>
                ) : null}
                {Number(quotaInfo.paidListingCredits || 0) > 0 ? (
                  <div className="quota-muted">Ücretli ilan hakkınız: {quotaInfo.paidListingCredits}</div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className={isWebSurface ? 'rfq-create-form--web' : ''}>
          {isWebSurface && stepError ? <div className="rfq-create-inline-alert">{stepError}</div> : null}
          {isWebSurface && error ? <div className="rfq-create-inline-alert rfq-create-inline-alert--error">{error}</div> : null}
          {step === 1 ? (
            <>
              <div className="form-group">
                <label>Segment</label>
                <div className="cats-inline-wrap">
                  <div className="cats-inline-scroll">
                    {SEGMENT_OPTIONS.map((option) => {
                      const isActive = form.segment === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`cats-inline-chip ${isActive ? 'active' : ''}`}
                          onClick={() => handleSegmentSelect(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {showStep1Errors && !canContinueStep1 && !form.segment ? <div className="error">Segment seç</div> : null}
              </div>
              <div className="form-group">
                <label htmlFor="title">Başlık</label>
                <input id="title" name="title" value={form.title} onChange={handleChange} required />
                {showStep1Errors && !canContinueStep1 && step1FieldErrors.title ? (
                  <div className="error">{step1FieldErrors.title}</div>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="categoryButton">Kategori</label>
                <button
                  id="categoryButton"
                  type="button"
                  className="secondary-btn category-select-btn"
                  disabled={!form.segment}
                  onClick={() => setIsCategoryModalOpen(true)}
                >
                  {form.segment ? (selectedCategoryLabel || 'Kategori seç') : 'Önce segment seç'}
                </button>
                {showStep1Errors && !canContinueStep1 && step1FieldErrors.categoryId ? (
                  <div className="error">{step1FieldErrors.categoryId}</div>
                ) : null}
              </div>
              {selectedCategoryLabel ? (
                <div className="rfq-sub category-chip-row">
                  <span>Seçili kategori: {selectedCategoryLabel}</span>
                  <button type="button" className="mini-clear-btn" onClick={handleClearCategory} aria-label="Seçimi kaldır">
                    ×
                  </button>
                </div>
              ) : null}

              <div className="form-group">
                <label htmlFor="description">Açıklama</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                />
                {showStep1Errors && !canContinueStep1 && step1FieldErrors.description ? (
                  <div className="error">{step1FieldErrors.description}</div>
                ) : null}
              </div>

              <div className="wizard-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canContinueStep1}
                  onClick={() => {
                    const detail = getStepErrorDetail(1);
                    if (detail.message) {
                      setStepError(detail.message);
                      showToast(detail.message);
                      logFlowEvent({ step: 1, event: 'step_blocked', field: detail.field, error: detail.message });
                      return;
                    }
                    setStepError('');
                    logFlowEvent({ step: 1, event: 'step_complete' });
                    setStep(2);
                  }}
                >
                  Devam Et
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="form-group">
                <label htmlFor="images">Fotoğraf Yükleme (Opsiyonel)</label>
                <input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => setImages(Array.from(event.target.files || []))}
                />
              </div>

              {isJobseekerSegment ? (
                <div className="form-group">
                  <label>Çalışma Tipi</label>
                  <div className="jobseeker-card-grid">
                    {JOBSEEKER_WORK_TYPES.map((option) => {
                      const isActive = jobseekerMeta.workTypes.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`jobseeker-option-card ${isActive ? 'active' : ''}`}
                          onClick={() => toggleJobseekerWorkType(option.value)}
                        >
                          <strong>{option.label}</strong>
                          <span>Bu çalışma modelini profiline ekle</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!isJobseekerSegment ? <div className="form-group">
                <label htmlFor="quantity">Adet</label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
              </div> : null}

              {isCarCategory ? (
                <div className="form-group">
                  <label>Araba Bilgisi</label>
                  <div className="rfq-sub">
                    Marka: {carBrand?.name || 'Seçilmedi'} / Model: {carModel?.name || 'Seçilmedi'}
                  </div>
                  {carVariant?.name ? <div className="rfq-sub">Tip: {carVariant.name}</div> : null}
                  <div className="wizard-actions wizard-actions-split">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarBrandSheetOpen(true)}
                    >
                      Marka Seç
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarModelSheetOpen(true)}
                      disabled={!carBrand}
                    >
                      Model Seç
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarVariantSheetOpen(true)}
                      disabled={!carModel}
                    >
                      Tip Seç
                    </button>
                  </div>
                  <div className="rfq-sub">Yıl (opsiyonel)</div>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={carYear}
                    onChange={(event) => setCarYear(event.target.value)}
                    placeholder="Yıl"
                  />
                </div>
              ) : null}

              {isJobseekerSegment ? (
                <>
                  <div className="form-group">
                    <label htmlFor="availabilityDate">Müsaitlik / Başlangıç Tarihi</label>
                    <input
                      id="availabilityDate"
                      type="date"
                      value={jobseekerMeta.availabilityDate}
                      onChange={(event) =>
                        setJobseekerMeta((prev) => ({ ...prev, availabilityDate: event.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="expectedPay">Beklenen Ücret (Opsiyonel)</label>
                    <input
                      id="expectedPay"
                      type="text"
                      value={jobseekerMeta.expectedPay}
                      onChange={(event) =>
                        setJobseekerMeta((prev) => ({ ...prev, expectedPay: event.target.value }))
                      }
                      placeholder="Örn: 25000 TL / ay"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="skills">Yetkinlikler (Opsiyonel)</label>
                    <input
                      id="skills"
                      type="text"
                      value={jobseekerMeta.skills}
                      onChange={(event) =>
                        setJobseekerMeta((prev) => ({ ...prev, skills: event.target.value }))
                      }
                      placeholder="Örn: Excel, satış, kaynak"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="shortNote">Kısa Not (Opsiyonel)</label>
                    <textarea
                      id="shortNote"
                      value={jobseekerMeta.shortNote}
                      onChange={(event) =>
                        setJobseekerMeta((prev) => ({ ...prev, shortNote: event.target.value }))
                      }
                      placeholder="Kendini kısaca anlat"
                    />
                  </div>
                </>
              ) : null}

              {!isJobseekerSegment ? <div className="form-group">
                <label htmlFor="targetPrice">Bütçe</label>
                <input
                  id="targetPrice"
                  name="targetPrice"
                  type="text"
                  min="0"
                  value={priceText}
                  onChange={handlePriceChange}
                  placeholder="Örn: 1.000"
                />
                <small className="input-helper">Binlik ayırıcı otomatik eklenir</small>
              </div> : null}

              {!isJobseekerSegment ? <div className="form-group">
                <label htmlFor="deadline">Teslim Süresi</label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={handleChange}
                  required
                />
              </div> : null}

              <div className="wizard-actions wizard-actions-split">
                <button type="button" className="secondary-btn" onClick={() => setStep(1)}>
                  Geri
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canContinueStep2}
                  onClick={() => {
                    const detail = getStepErrorDetail(2);
                    if (detail.message) {
                      setStepError(detail.message);
                      showToast(detail.message);
                      logFlowEvent({ step: 2, event: 'step_blocked', field: detail.field, error: detail.message });
                      return;
                    }
                    setStepError('');
                    logFlowEvent({ step: 2, event: 'step_complete' });
                    setStep(3);
                  }}
                >
                  Devam Et
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="form-group">
                <label htmlFor="city">Şehir</label>
                <input
                  id="city"
                  name="city"
                  value={form.city}
                  onChange={(event) => {
                    setCityQuery(event.target.value);
                    handleCityChange(event);
                  }}
                  list="rfq-cities"
                  required
                  placeholder="Şehir seçin"
                />
                <datalist id="rfq-cities">
                  {cityOptions.map((city) => (
                    <option key={city.id || city.name} value={city.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="district">İlçe</label>
                <input
                  id="district"
                  name="district"
                  value={form.district}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDistrictQuery(value);
                    setForm((prev) => ({
                      ...prev,
                      district: value,
                      neighborhood: '',
                      street: ''
                    }));
                    const selectedDistrict = findOptionByName(districtOptions, value);
                    setLocationIds((prev) => ({
                      ...prev,
                      districtId: selectedDistrict?.id || '',
                      neighborhoodId: ''
                    }));
                    setNeighborhoodQuery('');
                    setStreetQuery('');
                  }}
                  list="rfq-districts"
                  disabled={!form.city}
                  placeholder={form.city ? 'İlçe seçin' : 'Önce şehir seçin'}
                />
                <datalist id="rfq-districts">
                  {districtOptions.map((district) => (
                    <option key={district.id || district.name} value={district.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="neighborhood">Mahalle</label>
                <input
                  id="neighborhood"
                  name="neighborhood"
                  value={form.neighborhood}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNeighborhoodQuery(value);
                    setForm((prev) => ({
                      ...prev,
                      neighborhood: value,
                      street: ''
                    }));
                    const selectedNeighborhood = findOptionByName(neighborhoodOptions, value);
                    setLocationIds((prev) => ({
                      ...prev,
                      neighborhoodId: selectedNeighborhood?.id || ''
                    }));
                    setStreetQuery('');
                  }}
                  list="rfq-neighborhoods"
                  placeholder={form.district ? 'Mahalle seçin' : 'Önce ilçe seçin'}
                  disabled={!form.district}
                />
                <datalist id="rfq-neighborhoods">
                  {neighborhoodOptions.map((neighborhood) => (
                    <option key={neighborhood.id || neighborhood.name} value={neighborhood.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="street">Cadde / Sokak</label>
                <input
                  id="street"
                  name="street"
                  value={form.street}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStreetQuery(value);
                    setForm((prev) => ({
                      ...prev,
                      street: value
                    }));
                  }}
                  list="rfq-streets"
                  placeholder={form.neighborhood ? 'Cadde veya sokak seçin' : 'Önce mahalle seçin'}
                  disabled={!form.neighborhood}
                />
                <datalist id="rfq-streets">
                  {streetOptions.map((street) => (
                    <option key={`${street.id || street.name}-${street.type || ''}`} value={street.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <div className="location-header">
                  <label>Konum</label>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => requestCurrentLocation(false)}
                    disabled={locating}
                  >
                    {locating ? 'Konum aliniyor...' : 'Mevcut konumumu kullan'}
                  </button>
                </div>
                <Suspense fallback={<div className="map-picker-loading">Harita yükleniyor...</div>}>
                  <MapPicker value={selectedLocation} onChange={setSelectedLocation} height={240} />
                </Suspense>
                <small className="input-helper">
                  Şehri ve ilçeyi manuel seçip pin&apos;i haritadan yerleştir
                </small>
                {locationHint ? <div className="rfq-sub">{locationHint}</div> : null}
                {locationError ? <div className="error">{locationError}</div> : null}
                {selectedLocation && Number.isFinite(latitude) && Number.isFinite(longitude) ? (
                  <div className="rfq-sub">
                    Konum seçildi: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
                  </div>
                ) : null}
              </div>

              <div className="wizard-actions wizard-actions-split">
                <button type="button" className="secondary-btn" onClick={() => setStep(2)}>
                  Geri
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canContinueStep3}
                  onClick={() => {
                    const detail = getStepErrorDetail(3);
                    if (detail.message) {
                      setStepError(detail.message);
                      showToast(detail.message);
                      logFlowEvent({ step: 3, event: 'step_blocked', field: detail.field, error: detail.message });
                      return;
                    }
                    setStepError('');
                    logFlowEvent({ step: 3, event: 'step_complete' });
                    setStep(4);
                  }}
                >
                  Devam Et
                </button>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              {!premiumActive ? (
                <div className="premium-cta-card">
                  <div className="premium-cta-header">
                    <strong>Premium ile daha fazla görünür ol</strong>
                    <span>
                      {premiumPlan
                        ? `${premiumPlan.monthlyPrice} ${premiumPlan.currency}/ay • ${premiumPlan.yearlyPrice} ${premiumPlan.currency}/yıl`
                        : 'Aylık / Yıllık abone ol'}
                    </span>
                  </div>
                  <div className="premium-cta-actions">
                    {premiumModes.includes('monthly') ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleCheckout(premiumMonthlyCode)}
                        disabled={checkoutLoading === premiumMonthlyCode}
                      >
                        {checkoutLoading === premiumMonthlyCode ? 'Yönlendiriliyor...' : 'Aylık Abone Ol'}
                      </button>
                    ) : null}
                    {premiumModes.includes('yearly') ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleCheckout(premiumYearlyCode)}
                        disabled={checkoutLoading === premiumYearlyCode}
                      >
                        {checkoutLoading === premiumYearlyCode ? 'Yönlendiriliyor...' : 'Yıllık Abone Ol'}
                      </button>
                    ) : null}
                    {featuredPlan && featuredModes.includes('monthly') ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleCheckout(featuredMonthlyCode)}
                        disabled={checkoutLoading === featuredMonthlyCode}
                      >
                        {checkoutLoading === featuredMonthlyCode ? 'Yönlendiriliyor...' : 'Aylık Öne Çıkar'}
                      </button>
                    ) : null}
                    {featuredPlan && featuredModes.includes('yearly') ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleCheckout(featuredYearlyCode)}
                        disabled={checkoutLoading === featuredYearlyCode}
                      >
                        {checkoutLoading === featuredYearlyCode ? 'Yönlendiriliyor...' : 'Yıllık Öne Çıkar'}
                      </button>
                    ) : null}
                  </div>
                  <small className="input-helper">
                    {featuredPlan
                      ? featuredPlan.shortDescription || 'Öne çıkarma kredisi satın al.'
                      : 'Öne çıkarma kredisi satın al.'}
                  </small>
                </div>
              ) : (
                <div className="premium-cta-card">
                  <div className="premium-cta-header">
                    <strong>Premium üyesisin</strong>
                    <span>Talebini öne çıkarmak için hazırsın</span>
                  </div>
                </div>
              )}

              <div className="wizard-actions wizard-actions-split sticky-footer">
                <button type="button" className="secondary-btn" onClick={() => setStep(3)}>
                  Geri
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >
                  {loading ? 'Gönderiliyor...' : isEdit ? 'Kaydet' : 'Standart Talep Yayınla'}
                </button>
              </div>
            </>
          ) : null}

          {error ? <div className="error">{error}</div> : null}
          {stepError ? <div className="error">{stepError}</div> : null}
        </form>
      </div>

      {isCategoryModalOpen ? (
        <Suspense fallback={null}>
          <CategorySelector
            mode="modal"
            open={isCategoryModalOpen}
            title="Kategori Seç"
            selectedSegment={form.segment}
            onSegmentChange={handleSegmentSelect}
            onClose={() => setIsCategoryModalOpen(false)}
            onSelect={handleCategorySelect}
            onClear={handleClearCategory}
            selectedCategoryId={form.categoryId}
          />
        </Suspense>
      ) : null}
      {carBrandSheetOpen ? (
        <Suspense fallback={null}>
          <ReusableBottomSheet
            open={carBrandSheetOpen}
            onClose={() => setCarBrandSheetOpen(false)}
            title="Marka Seç"
            contentClassName="notif-sheet"
            initialSnap="mid"
          >
            <div className="notif-list">
              <input
                className="search-input"
                placeholder="Marka ara..."
                value={carBrandQuery}
                onChange={(event) => setCarBrandQuery(event.target.value)}
              />
              {carBrands.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="notif-item"
                  onClick={() => {
                    setCarBrand(item);
                    setCarModel(null);
                    setCarVariant(null);
                    setCarBrandSheetOpen(false);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </ReusableBottomSheet>
        </Suspense>
      ) : null}
      {carModelSheetOpen ? (
        <Suspense fallback={null}>
          <ReusableBottomSheet
            open={carModelSheetOpen}
            onClose={() => setCarModelSheetOpen(false)}
            title="Model Seç"
            contentClassName="notif-sheet"
            initialSnap="mid"
          >
            <div className="notif-list">
              <input
                className="search-input"
                placeholder="Model ara..."
                value={carModelQuery}
                onChange={(event) => setCarModelQuery(event.target.value)}
              />
              {carModels.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="notif-item"
                  onClick={() => {
                    setCarModel(item);
                    setCarVariant(null);
                    setCarModelSheetOpen(false);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </ReusableBottomSheet>
        </Suspense>
      ) : null}
      {carVariantSheetOpen ? (
        <Suspense fallback={null}>
          <ReusableBottomSheet
            open={carVariantSheetOpen}
            onClose={() => setCarVariantSheetOpen(false)}
            title="Tip Seç"
            contentClassName="notif-sheet"
            initialSnap="mid"
          >
            <div className="notif-list">
              <input
                className="search-input"
                placeholder="Tip ara..."
                value={carVariantQuery}
                onChange={(event) => setCarVariantQuery(event.target.value)}
              />
              {carVariants.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="notif-item"
                  onClick={() => {
                    setCarVariant({ _id: item._id, name: item.variantName || item.name });
                    setCarVariantSheetOpen(false);
                  }}
                >
                  {item.variantName || item.name}
                  {item.year ? <span className="notif-time">{item.year}</span> : null}
                </button>
              ))}
            </div>
          </ReusableBottomSheet>
        </Suspense>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default RFQCreate;
