import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import CategorySelector from '../components/CategorySelector';
import MapPicker from '../components/MapPicker';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import { useAuth } from '../context/AuthContext';

function RFQCreate({ mode = 'create', initialData = null, onSuccess, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
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
  const [images, setImages] = useState([]);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [priceValue, setPriceValue] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState('');
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
  const isEdit = mode === 'edit';
  const premiumActive = Boolean(
    user?.isPremium && (!user?.premiumUntil || new Date(user.premiumUntil) > new Date())
  );
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
  const isCarCategory = useMemo(() => {
    return /araba|otomobil/i.test(String(selectedCategoryLabel || ''));
  }, [selectedCategoryLabel]);

  useEffect(() => {
    if (!isEdit || !initialData) {
      return;
    }
    setForm({
      title: initialData.title || '',
      description: initialData.description || '',
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
  }, [initialData, isEdit]);

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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setSelectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
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
    requestCurrentLocation(true);
  }, []);

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

  const getStepError = (currentStep) => {
    if (currentStep === 1) {
      if (form.title.trim().length < 3) {
        return 'Başlık en az 3 karakter olmalı';
      }
      if (!form.categoryId) {
        return 'Kategori seç';
      }
      if (form.description.trim().length < 10) {
        return 'Açıklama en az 10 karakter olmalı';
      }
      return '';
    }

    if (currentStep === 2) {
      if (isCarCategory && (!carBrand || !carModel)) {
        return 'Marka ve model seç';
      }
      const quantityValue = Number(form.quantity);
      if (!Number.isFinite(quantityValue) || quantityValue < 1) {
        return 'Adet en az 1 olmalı';
      }
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        return 'Hedef fiyat gir';
      }
      if (!form.deadline) {
        return 'Teslim süresi seç';
      }
      const deadlineValue = new Date(form.deadline).getTime();
      if (!Number.isFinite(deadlineValue) || deadlineValue <= Date.now()) {
        return 'Teslim süresi gelecekte olmalı';
      }
      return '';
    }

    if (currentStep === 3) {
      if (!form.city) {
        return 'Şehir seç';
      }
      if (!form.district) {
        return 'İlçe seç';
      }
      if (
        !selectedLocation ||
        !Number.isFinite(Number(selectedLocation.lat)) ||
        !Number.isFinite(Number(selectedLocation.lng))
      ) {
        return 'Konum seç';
      }
      return '';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (step !== 4) {
      showToast('Lütfen adımları tamamla');
      return;
    }
    const validationError = getStepError(3);
    if (validationError) {
      setStepError(validationError);
      showToast(validationError);
      return;
    }
    setError('');
    setStepError('');
    console.log('RFQ_CREATE_START');
    setLoading(true);

    try {
      if (!selectedLocation || !Number.isFinite(Number(selectedLocation.lat)) || !Number.isFinite(Number(selectedLocation.lng))) {
        setError('Konum seç');
        setLoading(false);
        return;
      }
      if (isEdit && initialData?._id) {
        const payload = {
          title: form.title,
          description: form.description,
          categoryId: form.categoryId,
          cityId: locationIds.cityId || undefined,
          districtId: locationIds.districtId || undefined,
          neighborhood: form.neighborhood,
          street: form.street,
          quantity: Number(form.quantity),
          deadline: form.deadline,
          targetPrice: Number.isFinite(priceValue) ? priceValue : undefined,
          location: {
            type: 'Point',
            coordinates: [Number(selectedLocation.lng), Number(selectedLocation.lat)]
          },
          isAuction: Boolean(form.isAuction)
        };
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
        formData.append('categoryId', form.categoryId);
        formData.append('city', form.city);
        formData.append('district', form.district);
        formData.append('neighborhood', form.neighborhood);
        formData.append('street', form.street);
        formData.append('quantity', String(Number(form.quantity)));
        formData.append('deadline', form.deadline);
        formData.append('isAuction', String(Boolean(form.isAuction)));
        if (!form.deadline) {
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
          formData.append('expiresAt', expiresAt);
        }
        if (selectedLocation) {
          formData.append(
            'location',
            JSON.stringify({ type: 'Point', coordinates: [Number(selectedLocation.lng), Number(selectedLocation.lat)] })
          );
          formData.append('latitude', String(selectedLocation.lat));
          formData.append('longitude', String(selectedLocation.lng));
        }

    if (Number.isFinite(priceValue)) {
      formData.append('targetPrice', String(priceValue));
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

        setForm({
          title: '',
          description: '',
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
        setStep(1);
        setImages([]);
        setCarBrand(null);
        setCarModel(null);
        setCarVariant(null);
        setCarYear('');
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
      } else if (status === 400 || status === 422) {
        setError(message || 'Geçersiz bilgi');
        showToast(message || 'Geçersiz bilgi');
      } else if (status >= 500) {
        setError('Sunucu hatası, tekrar dene');
        showToast('Sunucu hatası, tekrar dene');
      } else {
        setError(message || (isEdit ? 'Talep guncellenemedi.' : 'Talep oluşturulamadı.'));
        showToast(message || (isEdit ? 'Talep guncellenemedi.' : 'Talep oluşturulamadı.'));
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

  const canContinueStep1 = getStepError(1) === '';
  const canContinueStep2 = getStepError(2) === '';
  const canContinueStep3 = getStepError(3) === '';

  const handleCheckout = async (planCode) => {
    try {
      setCheckoutLoading(planCode);
      const response = await api.post('/billing/checkout', { planCode });
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Checkout baslatilamadi.';
      setError(message);
      showToast(message);
    } finally {
      setCheckoutLoading('');
    }
  };

  return (
    <div className="page">
      <div className="card">
        <button type="button" className="icon-btn back-icon" onClick={handleBack} aria-label="Geri">
          ←
        </button>
        <h1>{isEdit ? 'Talep Düzenle' : 'Yeni RFQ Oluştur'}</h1>
        <div className="wizard-progress" aria-label="Adim ilerleme">
          {[1, 2, 3, 4].map((dot) => (
            <span key={dot} className={`wizard-dot ${step === dot ? 'active' : ''}`} />
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <div className="form-group">
                <label htmlFor="title">Başlık</label>
                <input id="title" name="title" value={form.title} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label htmlFor="categoryButton">Kategori</label>
                <button
                  id="categoryButton"
                  type="button"
                  className="secondary-btn category-select-btn"
                  onClick={() => setIsCategoryModalOpen(true)}
                >
                  {selectedCategoryLabel || 'Kategori sec'}
                </button>
              </div>
              {selectedCategoryLabel ? (
                <div className="rfq-sub category-chip-row">
                  <span>Secili kategori: {selectedCategoryLabel}</span>
                  <button type="button" className="mini-clear-btn" onClick={handleClearCategory} aria-label="Secimi kaldir">
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
              </div>

              <div className="wizard-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canContinueStep1}
                  onClick={() => {
                    const validationError = getStepError(1);
                    if (validationError) {
                      setStepError(validationError);
                      showToast(validationError);
                      return;
                    }
                    setStepError('');
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
                <label htmlFor="images">Foto Yükleme (Opsiyonel)</label>
                <input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => setImages(Array.from(event.target.files || []))}
                />
              </div>

              <div className="form-group">
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
              </div>

              {isCarCategory ? (
                <div className="form-group">
                  <label>Araba Bilgisi</label>
                  <div className="rfq-sub">
                    Marka: {carBrand?.name || 'Secilmedi'} / Model: {carModel?.name || 'Secilmedi'}
                  </div>
                  {carVariant?.name ? <div className="rfq-sub">Tip: {carVariant.name}</div> : null}
                  <div className="wizard-actions wizard-actions-split">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarBrandSheetOpen(true)}
                    >
                      Marka Sec
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarModelSheetOpen(true)}
                      disabled={!carBrand}
                    >
                      Model Sec
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setCarVariantSheetOpen(true)}
                      disabled={!carModel}
                    >
                      Tip Sec
                    </button>
                  </div>
                  <div className="rfq-sub">Yil (opsiyonel)</div>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={carYear}
                    onChange={(event) => setCarYear(event.target.value)}
                    placeholder="Yil"
                  />
                </div>
              ) : null}

              <div className="form-group">
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
              </div>

              <div className="form-group">
                <label htmlFor="deadline">Teslim Süresi</label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="wizard-actions wizard-actions-split">
                <button type="button" className="secondary-btn" onClick={() => setStep(1)}>
                  Geri
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canContinueStep2}
                  onClick={() => {
                    const validationError = getStepError(2);
                    if (validationError) {
                      setStepError(validationError);
                      showToast(validationError);
                      return;
                    }
                    setStepError('');
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
                <label htmlFor="city">Sehir</label>
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
                  placeholder="Sehir secin"
                />
                <datalist id="rfq-cities">
                  {cityOptions.map((city) => (
                    <option key={city.id || city.name} value={city.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="district">Ilce</label>
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
                  placeholder={form.city ? 'Ilce secin' : 'Once sehir secin'}
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
                  placeholder={form.district ? 'Mahalle secin' : 'Once ilce secin'}
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
                  placeholder={form.neighborhood ? 'Cadde veya sokak secin' : 'Once mahalle secin'}
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
                    className="secondary-btn location-btn"
                    onClick={() => requestCurrentLocation(false)}
                    disabled={locating}
                  >
                    {locating ? 'Konum aliniyor...' : 'Şu anki konum'}
                  </button>
                </div>
                <MapPicker value={selectedLocation} onChange={setSelectedLocation} height={240} />
                <small className="input-helper">
                  Pin&apos;i haritadan seç
                </small>
                {locationError ? <div className="error">{locationError}</div> : null}
                {selectedLocation ? (
                  <div className="rfq-sub">Konum seçildi</div>
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
                    const validationError = getStepError(3);
                    if (validationError) {
                      setStepError(validationError);
                      showToast(validationError);
                      return;
                    }
                    setStepError('');
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
                    <span>Aylik / Yillik abone ol</span>
                  </div>
                  <div className="premium-cta-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => handleCheckout('premium_monthly')}
                      disabled={checkoutLoading === 'premium_monthly'}
                    >
                      {checkoutLoading === 'premium_monthly' ? 'Yonlendiriliyor...' : 'Aylik Abone Ol'}
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => handleCheckout('premium_yearly')}
                      disabled={checkoutLoading === 'premium_yearly'}
                    >
                      {checkoutLoading === 'premium_yearly' ? 'Yonlendiriliyor...' : 'Yillik Abone Ol'}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => handleCheckout('featured_one_time')}
                      disabled={checkoutLoading === 'featured_one_time'}
                    >
                      {checkoutLoading === 'featured_one_time' ? 'Yonlendiriliyor...' : 'Öne Çıkanlar (Tek Seferlik)'}
                    </button>
                  </div>
                  <small className="input-helper">
                    Tek seferlik: ilanını öne çıkarma kredisi alırsın.
                  </small>
                </div>
              ) : (
                <div className="premium-cta-card">
                  <div className="premium-cta-header">
                    <strong>Premium üyesisin ✅</strong>
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

      <CategorySelector
        mode="modal"
        open={isCategoryModalOpen}
        title="Kategori Sec"
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={handleCategorySelect}
        onClear={handleClearCategory}
        selectedCategoryId={form.categoryId}
      />
      <ReusableBottomSheet
        open={carBrandSheetOpen}
        onClose={() => setCarBrandSheetOpen(false)}
        title="Marka Sec"
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
      <ReusableBottomSheet
        open={carModelSheetOpen}
        onClose={() => setCarModelSheetOpen(false)}
        title="Model Sec"
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
      <ReusableBottomSheet
        open={carVariantSheetOpen}
        onClose={() => setCarVariantSheetOpen(false)}
        title="Tip Sec"
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
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default RFQCreate;
