import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminListingQuota() {
  const [form, setForm] = useState({
    periodDays: 30,
    maxFree: 5,
    extraPrice: 99,
    currency: 'TRY',
    extraEnabled: true,
    paymentMethodSetupEnabled: true,
    paymentMethodSetupPrice: 1
  });
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
        const res = await api.get('/admin/system/listing-quota');
        if (!active) return;
        setForm((prev) => ({ ...prev, ...(res?.data?.data || {}) }));
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

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      setSaving(true);
      await api.patch('/admin/system/listing-quota', {
        periodDays: Number(form.periodDays),
        maxFree: Number(form.maxFree),
        extraPrice: Number(form.extraPrice),
        currency: form.currency,
        extraEnabled: Boolean(form.extraEnabled),
        paymentMethodSetupEnabled: Boolean(form.paymentMethodSetupEnabled),
        paymentMethodSetupPrice: Number(form.paymentMethodSetupPrice)
      });
      setMessage('Ayarlar güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Ayarlar güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">İlan Kotası & Ücret</div>
      <div className="admin-panel-body">
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <form className="admin-form" onSubmit={handleSave}>
            <div className="admin-field">
              <label className="admin-label">Dönem süresi (gün)</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                value={form.periodDays}
                onChange={(event) => handleChange('periodDays', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Ücretsiz ilan hakkı</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                value={form.maxFree}
                onChange={(event) => handleChange('maxFree', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Ek ilan ücreti</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                value={form.extraPrice}
                onChange={(event) => handleChange('extraPrice', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Para birimi</label>
              <input
                className="admin-input"
                type="text"
                value={form.currency}
                onChange={(event) => handleChange('currency', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Ek ilan aktif</label>
              <select
                className="admin-input"
                value={form.extraEnabled ? 'true' : 'false'}
                onChange={(event) => handleChange('extraEnabled', event.target.value === 'true')}
              >
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Kart ekleme aktif</label>
              <select
                className="admin-input"
                value={form.paymentMethodSetupEnabled ? 'true' : 'false'}
                onChange={(event) => handleChange('paymentMethodSetupEnabled', event.target.value === 'true')}
              >
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Kart ekleme ücreti</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                value={form.paymentMethodSetupPrice}
                onChange={(event) => handleChange('paymentMethodSetupPrice', event.target.value)}
              />
              <div className="admin-muted">Kart doğrulaması için küçük ücret belirleyebilirsin.</div>
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
