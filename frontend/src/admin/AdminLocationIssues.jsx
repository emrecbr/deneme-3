import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { formatAdminCityName, formatAdminDistrictName } from './adminLocationUtils';

export default function AdminLocationIssues() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [fixForm, setFixForm] = useState({ cityId: '', districtId: '', lat: '', lng: '' });
  const [message, setMessage] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
  const issueLabels = {
    missing_city: 'Sehir eksik',
    missing_district: 'Ilce eksik',
    missing_coordinates: 'Koordinat eksik',
    missing_location_data: 'Konum bilgisi eksik'
  };

  const resolveCityId = (rfq) => {
    const direct = rfq?.city;
    if (isObjectId(direct)) return direct;
    const nameCandidate = typeof direct === 'string' && !isObjectId(direct) ? direct : rfq?.locationData?.city;
    if (!nameCandidate) return '';
    const match = cities.find((city) => city.name?.toLowerCase() === String(nameCandidate).toLowerCase());
    return match?._id || '';
  };

  const resolveDistrictId = (rfq, resolvedCityId) => {
    const direct = rfq?.district;
    if (isObjectId(direct)) return direct;
    const nameCandidate = typeof direct === 'string' && !isObjectId(direct) ? direct : rfq?.locationData?.district;
    if (!nameCandidate) return '';
    const match = districts.find((district) => {
      if (!district?.name) return false;
      const sameName = district.name.toLowerCase() === String(nameCandidate).toLowerCase();
      if (!sameName) return false;
      if (!resolvedCityId) return true;
      const cityId = district.city?._id || district.city;
      return String(cityId) === String(resolvedCityId);
    });
    return match?._id || '';
  };

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [issuesRes, citiesRes, districtsRes] = await Promise.all([
        api.get('/admin/location/issues?limit=50'),
        api.get('/admin/location/cities?includeInactive=true'),
        api.get('/admin/location/districts?includeInactive=true&limit=500')
      ]);
      setItems(issuesRes.data?.items || []);
      setCities(citiesRes.data?.items || []);
      setDistricts(districtsRes.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Konum sorunlari alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected?.rfq?._id) {
      return;
    }
    const cityId = resolveCityId(selected.rfq);
    const districtId = resolveDistrictId(selected.rfq, cityId);
    const lat = selected.rfq?.location?.coordinates?.[1] ?? '';
    const lng = selected.rfq?.location?.coordinates?.[0] ?? '';

    setFixForm({
      cityId,
      districtId,
      lat: lat === undefined || lat === null ? '' : String(lat),
      lng: lng === undefined || lng === null ? '' : String(lng)
    });
  }, [selected, cities, districts]);

  const startFix = (item) => {
    setSelected(item);
    setMessage('');
  };

  const filteredDistricts = useMemo(() => {
    if (!fixForm.cityId) {
      return districts;
    }
    return districts.filter((district) => String(district.city?._id || district.city) === String(fixForm.cityId));
  }, [districts, fixForm.cityId]);

  const applyFix = async () => {
    if (!selected?.rfq?._id) return;
    setMessage('');
    try {
      await api.patch(`/admin/location/issues/${selected.rfq._id}`, {
        cityId: fixForm.cityId || undefined,
        districtId: fixForm.districtId || undefined,
        latitude: fixForm.lat === '' ? undefined : fixForm.lat,
        longitude: fixForm.lng === '' ? undefined : fixForm.lng
      });
      setItems((prev) => prev.filter((item) => item.rfq?._id !== selected.rfq._id));
      setMessage('Duzeltme kaydedildi ve kayit listeden kaldirildi.');
      setSelected(null);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Duzeltme basarisiz.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Konum Sorunlari</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yukleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Sorunlu kayit yok.</div>
        ) : (
          <ul className="admin-list">
            {items.map((item, idx) => (
              <li key={`${item.rfq?._id}-${idx}`}>
                <div>
                  <strong>{item.rfq?.title}</strong>
                  <span className="admin-muted">{issueLabels[item.type] || item.type}</span>
                  <span className="admin-muted">
                    Sehir: {formatAdminCityName(item.rfq)} • Ilce: {formatAdminDistrictName(item.rfq)}
                  </span>
                </div>
                <button type="button" className="admin-btn" onClick={() => startFix(item)}>
                  Duzelt
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <>
            <div className="admin-divider"></div>
            <div className="admin-panel-subtitle">Konum Duzeltme Formu</div>
            <div className="admin-muted">
              Mevcut sehir: {formatAdminCityName(selected.rfq)} • Mevcut ilce: {formatAdminDistrictName(selected.rfq)}
            </div>
            <div className="admin-form-grid">
              <label>
                Sehir
                <select
                  className="admin-input"
                  value={fixForm.cityId}
                  onChange={(e) => setFixForm({ ...fixForm, cityId: e.target.value, districtId: '' })}
                >
                  <option value="">Sehir secin</option>
                  {cities.map((city) => (
                    <option key={city._id} value={city._id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ilce
                <select
                  className="admin-input"
                  value={fixForm.districtId}
                  onChange={(e) => setFixForm({ ...fixForm, districtId: e.target.value })}
                >
                  <option value="">{fixForm.cityId ? 'Ilce secin' : 'Once sehir secin'}</option>
                  {filteredDistricts.map((district) => (
                    <option key={district._id} value={district._id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Enlem
                <input className="admin-input" value={fixForm.lat} onChange={(e) => setFixForm({ ...fixForm, lat: e.target.value })} />
              </label>
              <label>
                Boylam
                <input className="admin-input" value={fixForm.lng} onChange={(e) => setFixForm({ ...fixForm, lng: e.target.value })} />
              </label>
            </div>
            <div className="admin-action-row">
              <button type="button" className="admin-btn" onClick={applyFix}>
                Kaydet
              </button>
              <button type="button" className="secondary-btn" onClick={() => setSelected(null)}>
                Vazgec
              </button>
              {message ? <span className="admin-muted">{message}</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
