import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import ReusableBottomSheet from '../components/ReusableBottomSheet';

const emptyForm = {
  title: '',
  city: '',
  district: '',
  neighborhood: '',
  street: '',
  addressDetail: ''
};

function ProfileAddresses({ surfaceVariant = 'app' }) {
  const isWebSurface = surfaceVariant === 'web';
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
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

  const editorOpen = isWebSurface ? sheetOpen : false;

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

  const showToast = (message) => {
    if (!message) return;
    setToast(message);
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(''), 2500);
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
  }, [form.city, form.district, form.neighborhood, streetQuery, locationIds.neighborhoodId]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/addresses');
      setAddresses(response.data?.data || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Adresler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const resetEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setCityQuery('');
    setDistrictQuery('');
    setNeighborhoodQuery('');
    setStreetQuery('');
    setLocationIds({ cityId: '', districtId: '', neighborhoodId: '' });
  };

  const openCreate = () => {
    resetEditor();
    setSheetOpen(true);
  };

  const openEdit = (address) => {
    setEditing(address);
    setForm({
      title: address.title || '',
      city: address.city || '',
      district: address.district || '',
      neighborhood: address.neighborhood || '',
      street: address.street || '',
      addressDetail: address.addressDetail || address.addressLine || ''
    });
    setLocationIds({ cityId: '', districtId: '', neighborhoodId: '' });
    setFormError('');
    setSheetOpen(true);
  };

  const closeEditor = () => {
    setSheetOpen(false);
    resetEditor();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  const validate = () => {
    if (!form.city.trim()) return 'İl seç';
    if (!form.district.trim()) return 'İlçe seç';
    if (!form.neighborhood.trim()) return 'Mahalle seç';
    if (!form.street.trim()) return 'Cadde/Sokak gir';
    if (!form.addressDetail.trim() || form.addressDetail.trim().length < 10) {
      return 'Detay adres gir';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      showToast(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        city: form.city,
        district: form.district,
        neighborhood: form.neighborhood,
        street: form.street,
        addressDetail: form.addressDetail
      };
      if (editing?._id) {
        await api.patch(`/addresses/${editing._id}`, payload);
        showToast('Adres güncellendi');
      } else {
        await api.post('/addresses', payload);
        showToast('Adres eklendi');
      }
      closeEditor();
      await fetchAddresses();
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'İşlem başarısız';
      setFormError(message);
      showToast(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId) => {
    if (!addressId) return;
    if (!window.confirm('Adresi silmek istiyor musun?')) return;
    try {
      await api.delete(`/addresses/${addressId}`);
      showToast('Adres silindi');
      await fetchAddresses();
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Adres silinemedi');
    }
  };

  const sortedAddresses = useMemo(() => {
    return [...addresses].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [addresses]);

  const renderAddressForm = () => (
    <form className={`offer-sheet-form ${isWebSurface ? 'website-profile-address-editor' : ''}`} onSubmit={handleSubmit} data-rb-no-drag="true">
      <div className={isWebSurface ? 'website-profile-inline-card__head' : ''}>
        <div>
          <h3>{editing ? 'Adresi Düzenle' : 'Yeni Adres Ekle'}</h3>
          {isWebSurface ? <p className="account-muted">Teslimat ve konum işlemlerinde kullanacağın adresi ayrıntılı şekilde kaydet.</p> : null}
        </div>
      </div>
      <label className="offer-field">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Ev / İş / Depo"
          aria-label="Başlık"
        />
      </label>
      <div className={isWebSurface ? 'website-profile-form-grid' : ''}>
        <label className="offer-field">
          <span>İl</span>
          <input
            name="city"
            value={form.city}
            onChange={(event) => {
              setCityQuery(event.target.value);
              handleCityChange(event);
            }}
            list="address-cities"
            placeholder="İl seçin"
          />
          <datalist id="address-cities">
            {cityOptions.map((city) => (
              <option key={city.id || city.name} value={city.name} />
            ))}
          </datalist>
        </label>

        <label className="offer-field">
          <span>İlçe</span>
          <input
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
            list="address-districts"
            disabled={!form.city}
            placeholder={form.city ? 'İlçe seçin' : 'Önce il seçin'}
          />
          <datalist id="address-districts">
            {districtOptions.map((district) => (
              <option key={district.id || district.name} value={district.name} />
            ))}
          </datalist>
        </label>

        <label className="offer-field">
          <span>Mahalle</span>
          <input
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
            list="address-neighborhoods"
            disabled={!form.district}
            placeholder={form.district ? 'Mahalle seçin' : 'Önce ilçe seçin'}
          />
          <datalist id="address-neighborhoods">
            {neighborhoodOptions.map((neighborhood) => (
              <option key={neighborhood.id || neighborhood.name} value={neighborhood.name} />
            ))}
          </datalist>
        </label>

        <label className="offer-field">
          <span>Cadde / Sokak</span>
          <input
            name="street"
            value={form.street}
            onChange={(event) => {
              const value = event.target.value;
              setStreetQuery(value);
              setForm((prev) => ({ ...prev, street: value }));
            }}
            list="address-streets"
            disabled={!form.neighborhood}
            placeholder={form.neighborhood ? 'Cadde veya sokak seçin' : 'Önce mahalle seçin'}
          />
          <datalist id="address-streets">
            {streetOptions.map((street) => (
              <option key={`${street.id || street.name}-${street.type || ''}`} value={street.name} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="offer-field">
        <span>Detay Adres</span>
        <textarea
          name="addressDetail"
          rows={5}
          placeholder="Bina no, daire no, kat, teslimat notu ve tarif..."
          value={form.addressDetail}
          onChange={handleChange}
        />
      </label>
      {formError ? <div className="error">{formError}</div> : null}
      <div className="offer-sheet-footer">
        <div className="offer-sheet-actions">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" className="secondary-btn" onClick={closeEditor}>
            Vazgeç
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className={`account-page ${isWebSurface ? 'account-page--web website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modülü</p>
            <h2>Adreslerim</h2>
            <p>Adres kayıtlarını web-first kart düzeninde görüntüle, düzenle ve yeni adres ekle.</p>
          </div>
        </div>
      ) : (
        <div className="account-header">
          <BackIconButton />
          <h1>Adreslerim</h1>
        </div>
      )}

      <section className="card account-card">
        <div className="website-profile-inline-card__head">
          <div>
            <h2>Adreslerim</h2>
            <p className="rfq-sub">Teslimat, teklif ve konum akışlarında kullanacağın kayıtlı adresler.</p>
          </div>
          <button type="button" className="secondary-btn" onClick={openCreate}>
            {editorOpen ? 'Yeni Form Açık' : 'Adres Ekle'}
          </button>
        </div>

        {loading ? (
          <div className="website-profile-state-card">
            <strong>Adresler yükleniyor</strong>
            <p>Kayıtlı adreslerin getiriliyor.</p>
          </div>
        ) : null}

        {error ? (
          <div className="website-profile-state-card website-profile-state-card--error">
            <strong>Adresler alınamadı</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error && !sortedAddresses.length ? (
          <div className="website-profile-state-card website-profile-state-card--empty">
            <strong>Henüz adres kaydın yok</strong>
            <p>Teslimat ve konum işlemlerinde hız kazanmak için ilk adresini ekleyebilirsin.</p>
            <button type="button" className="primary-btn" onClick={openCreate}>
              İlk Adresi Ekle
            </button>
          </div>
        ) : null}

        {!loading && !error && sortedAddresses.length ? (
          <div className="address-list website-profile-address-list">
            {sortedAddresses.map((address) => (
              <article key={address._id} className="offer-card offer-card-editable website-profile-record-card">
                <div className="offer-top">
                  <strong>{address.title || 'Adres'}</strong>
                  <span className="website-profile-address-badge">
                    {address.updatedAt ? 'Güncel' : 'Kayıtlı'}
                  </span>
                </div>
                <div className="rfq-sub">
                  {address.city} / {address.district}
                </div>
                <div className="rfq-sub">
                  {address.neighborhood} {address.street}
                </div>
                <div className="rfq-sub address-detail-preview">
                  {(address.addressDetail || address.addressLine || '').split('\n')[0]}
                </div>
                <div className="offer-actions-row">
                  <button type="button" className="secondary-btn" onClick={() => openEdit(address)}>
                    Düzenle
                  </button>
                  <button type="button" className="danger-btn" onClick={() => handleDelete(address._id)}>
                    Sil
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {editorOpen ? (
          <div className="website-profile-inline-panel website-profile-address-panel">
            {renderAddressForm()}
          </div>
        ) : null}
      </section>

      {!isWebSurface ? (
        <ReusableBottomSheet
          open={sheetOpen}
          onClose={closeEditor}
          title={editing ? 'Adres Düzenle' : 'Adres Ekle'}
          contentClassName="offer-sheet"
          headerRight={
            <button type="button" className="offer-sheet-close" onClick={closeEditor} aria-label="Kapat">
              ×
            </button>
          }
        >
          {renderAddressForm()}
        </ReusableBottomSheet>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default ProfileAddresses;
