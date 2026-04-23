import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminMapTest() {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('30');
  const [categoryId, setCategoryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, cityRes] = await Promise.all([
          api.get('/admin/categories?includeInactive=true'),
          api.get('/admin/location/cities?includeInactive=true&limit=200')
        ]);
        setCategories(catRes.data?.items || []);
        setCities(cityRes.data?.items || []);
      } catch (_error) {
        setCategories([]);
        setCities([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!cityId) {
      setDistricts([]);
      return;
    }
    const loadDistricts = async () => {
      try {
        const response = await api.get('/admin/location/districts', { params: { cityId, includeInactive: true, limit: 200 } });
        setDistricts(response.data?.items || []);
      } catch (_error) {
        setDistricts([]);
      }
    };
    loadDistricts();
  }, [cityId]);

  const runTest = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (lat) params.lat = lat;
      if (lng) params.lng = lng;
      if (radius) params.radius = radius;
      if (categoryId) params.categoryId = categoryId;
      if (cityId) params.cityId = cityId;
      if (districtId) params.districtId = districtId;
      const response = await api.get('/admin/map/test', { params });
      setResults(response.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Harita testi çalıştırılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Harita Test Ekranı</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            <span>Test lat</span>
            <input className="admin-input" value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label>
            <span>Test lng</span>
            <input className="admin-input" value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
          <label>
            <span>Yarıçap (km)</span>
            <input className="admin-input" value={radius} onChange={(e) => setRadius(e.target.value)} />
          </label>
          <label>
            <span>Kategori</span>
            <select className="admin-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tümü</option>
              {categories.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Şehir</span>
            <select className="admin-input" value={cityId} onChange={(e) => { setCityId(e.target.value); setDistrictId(''); }}>
              <option value="">Seçin</option>
              {cities.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>İlçe</span>
            <select className="admin-input" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">Seçin</option>
              {districts.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={runTest} disabled={loading}>
            {loading ? 'Çalışıyor…' : 'Test Et'}
          </button>
        </div>

        {results ? (
          <div className="admin-panel">
            <div className="admin-panel-title">Sonuçlar</div>
            <div className="admin-panel-body">
              <div className="admin-muted">Bulunan ilan: {results.count}</div>
              {results.cityFallbackApplied ? <div className="admin-muted">Şehir fallback devrede</div> : null}
              {results.items?.length ? (
                <ul className="admin-list">
                  {results.items.map((item) => (
                    <li key={item._id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span className="admin-muted">{item.city} {item.district ? `• ${item.district}` : ''}</span>
                      </div>
                      <span className="admin-muted">{item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="admin-empty">Kayıt bulunamadı.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
