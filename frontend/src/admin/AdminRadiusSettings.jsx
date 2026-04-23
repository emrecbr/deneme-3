import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const defaultValues = {
  min: 5,
  max: 80,
  step: 1,
  default: 30,
  cityFallbackEnabled: true,
  liveLocationEnabled: true
};

export default function AdminRadiusSettings() {
  const [form, setForm] = useState(defaultValues);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/location/radius-settings');
      setForm({ ...defaultValues, ...(response.data?.data || {}) });
    } catch (err) {
      setError(err?.response?.data?.message || 'Ayarlar alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const save = async () => {
    setMessage('');
    try {
      await api.patch('/admin/location/radius-settings', {
        min: Number(form.min),
        max: Number(form.max),
        step: Number(form.step),
        default: Number(form.default),
        cityFallbackEnabled: Boolean(form.cityFallbackEnabled),
        liveLocationEnabled: Boolean(form.liveLocationEnabled)
      });
      setMessage('Ayarlar kaydedildi.');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Ayarlar kaydedilemedi.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Canlı Konum / Yarıçap Ayarları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? <div className="admin-empty">Yükleniyor…</div> : null}
        <div className="admin-form-grid">
          <label>
            Min Radius (km)
            <input className="admin-input" type="number" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
          </label>
          <label>
            Max Radius (km)
            <input className="admin-input" type="number" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
          </label>
          <label>
            Step
            <input className="admin-input" type="number" value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value })} />
          </label>
          <label>
            Default Radius (km)
            <input className="admin-input" type="number" value={form.default} onChange={(e) => setForm({ ...form, default: e.target.value })} />
          </label>
          <label>
            Şehir Fallback Aktif
            <select className="admin-input" value={form.cityFallbackEnabled ? '1' : '0'} onChange={(e) => setForm({ ...form, cityFallbackEnabled: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          </label>
          <label>
            Canlı Konum Aktif
            <select className="admin-input" value={form.liveLocationEnabled ? '1' : '0'} onChange={(e) => setForm({ ...form, liveLocationEnabled: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={save}>Kaydet</button>
          {message ? <span className="admin-muted">{message}</span> : null}
        </div>
      </div>
    </div>
  );
}
