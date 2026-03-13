import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminLocationIssues() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [fixForm, setFixForm] = useState({ cityId: '', districtId: '', lat: '', lng: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/admin/location/issues?limit=50');
      setItems(response.data?.items || []);
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
    setSelected(item);
    setFixForm({ cityId: '', districtId: '', lat: '', lng: '' });
  };

  const applyFix = async () => {
    if (!selected?.rfq?._id) return;
    setMessage('');
    try {
      await api.patch(`/admin/location/issues/${selected.rfq._id}`, {
        cityId: fixForm.cityId || undefined,
        districtId: fixForm.districtId || undefined,
        latitude: fixForm.lat || undefined,
        longitude: fixForm.lng || undefined
      });
      setMessage('Düzeltme kaydedildi.');
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
                Şehir ID
                <input className="admin-input" value={fixForm.cityId} onChange={(e) => setFixForm({ ...fixForm, cityId: e.target.value })} />
              </label>
              <label>
                İlçe ID
                <input className="admin-input" value={fixForm.districtId} onChange={(e) => setFixForm({ ...fixForm, districtId: e.target.value })} />
              </label>
              <label>
                Latitude
                <input className="admin-input" value={fixForm.lat} onChange={(e) => setFixForm({ ...fixForm, lat: e.target.value })} />
              </label>
              <label>
                Longitude
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
