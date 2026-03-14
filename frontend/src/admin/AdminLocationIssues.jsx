import { useEffect, useState } from 'react';
import api from '../api/axios';

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

  const resolveCityId = (rfq) => {
    const direct = rfq?.city;
    if (isObjectId(direct)) return direct;
    const nameCandidate = typeof direct === 'string' ? direct : rfq?.locationData?.city;
    if (!nameCandidate) return '';
    const match = cities.find((city) => city.name?.toLowerCase() === String(nameCandidate).toLowerCase());
    return match?._id || '';
  };

  const resolveDistrictId = (rfq, resolvedCityId) => {
    const direct = rfq?.district;
    if (isObjectId(direct)) return direct;
    const nameCandidate = typeof direct === 'string' ? direct : rfq?.locationData?.district;
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
      setError(err?.response?.data?.message || 'Konum sorunları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startFix = (item) => {
    const rfq = item?.rfq;
    const cityId = resolveCityId(rfq);
    const districtId = resolveDistrictId(rfq, cityId);
    const lat = rfq?.location?.coordinates?.[1] ?? '';
    const lng = rfq?.location?.coordinates?.[0] ?? '';
    setSelected(item);
    setMessage('');
    setFixForm({
      cityId,
      districtId,
      lat: lat === undefined || lat === null ? '' : String(lat),
      lng: lng === undefined || lng === null ? '' : String(lng)
    });
  };

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
      setMessage('Düzeltme kaydedildi.');
      setItems((prev) => prev.filter((item) => item.rfq?._id !== selected.rfq._id));
      setSelected(null);
      load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Düzeltme başarısız.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Konum Sorunları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Sorunlu kayıt yok.</div>
        ) : (
          <ul className="admin-list">
            {items.map((item, idx) => (
              <li key={`${item.rfq?._id}-${idx}`}>
                <div>
                  <strong>{item.rfq?.title}</strong>
                  <span className="admin-muted">{item.type}</span>
                </div>
                <button type="button" className="admin-btn" onClick={() => startFix(item)}>
                  Düzelt
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <>
            <div className="admin-divider"></div>
            <div className="admin-panel-subtitle">Düzeltme</div>
            <div className="admin-form-grid">
              <label>
                Şehir
                <select className="admin-input" value={fixForm.cityId} onChange={(e) => setFixForm({ ...fixForm, cityId: e.target.value, districtId: '' })}>
                  <option value="">Seçin</option>
                  {cities.map((city) => (
                    <option key={city._id} value={city._id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                İlçe
                <select className="admin-input" value={fixForm.districtId} onChange={(e) => setFixForm({ ...fixForm, districtId: e.target.value })}>
                  <option value="">Seçin</option>
                  {(fixForm.cityId
                    ? districts.filter((district) => String(district.city?._id || district.city) === String(fixForm.cityId))
                    : districts
                  ).map((district) => (
                    <option key={district._id} value={district._id}>{district.name}</option>
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
              <button type="button" className="admin-btn" onClick={applyFix}>Kaydet</button>
              {message ? <span className="admin-muted">{message}</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
