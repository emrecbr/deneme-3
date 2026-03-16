import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminListingExpiry() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/admin/system/listing-expiry');
        if (!active) return;
        const value = res?.data?.data?.days;
        setDays(Number(value || 30));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Ayarlar alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const next = Number(days);
    if (!Number.isFinite(next) || next <= 0) {
      setError('Gün değeri geçersiz.');
      return;
    }
    try {
      setSaving(true);
      await api.patch('/admin/system/listing-expiry', { days: next });
      setMessage('Ayar güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Ayar güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">İlan Yayın Süresi</div>
      <div className="admin-panel-body">
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <form className="admin-form" onSubmit={handleSave}>
            <div className="admin-field">
              <label className="admin-label">İlan yayın süresi (gün)</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
              <div className="admin-muted">Örnek: 30 gün. Süre dolunca ilan yayından kalkar.</div>
            </div>
            {error ? <div className="admin-error">{error}</div> : null}
            {message ? <div className="admin-muted">{message}</div> : null}
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
