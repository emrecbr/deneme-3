import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

const formatWindow = (windowMs) => {
  const minutes = Math.round(Number(windowMs || 0) / 60000);
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} gün`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} saat`;
  return `${minutes || 1} dakika`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const sortSettings = (settings) =>
  Object.entries(settings || {}).sort(([left], [right]) => left.localeCompare(right, 'tr'));

export default function AdminApiRateLimits() {
  const [settings, setSettings] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const rows = useMemo(() => sortSettings(settings), [settings]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [settingsRes, eventsRes] = await Promise.all([
        api.get('/admin/system/api-rate-limits'),
        api.get('/admin/security/rate-limit-events?limit=50')
      ]);
      setSettings(settingsRes.data?.data || {});
      setEvents(eventsRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'API limit ayarları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatePolicy = (key, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: field === 'message' ? value : Number(value)
      }
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      setSaving(true);
      const payload = Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [
          key,
          {
            max: Number(value.max),
            windowMs: Number(value.windowMs),
            message: value.message || ''
          }
        ])
      );
      const response = await api.patch('/admin/system/api-rate-limits', payload);
      setSettings(response.data?.data || payload);
      setMessage('API limitleri güncellendi.');
      const eventsRes = await api.get('/admin/security/rate-limit-events?limit=50');
      setEvents(eventsRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'API limitleri kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Güvenlik & API Limitleri</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu ayarlar ilan kotası ve paket fiyatlarından bağımsızdır. Spam, bot ve maliyet
          kontrolü için API isteklerini sınırlar; değişiklikler backend deploy gerektirmez.
        </div>

        {loading ? <div className="admin-empty">Yükleniyor...</div> : null}
        {error ? <div className="admin-error">{error}</div> : null}
        {message ? <div className="admin-muted">{message}</div> : null}

        {!loading ? (
          <form className="admin-form" onSubmit={handleSave}>
            <div className="admin-card">
              <div className="admin-card-title">Rate Limit Ayarları</div>
              <div className="admin-muted">
                Pencere süresi milisaniye olarak saklanır. Örnek: 60000 = 1 dakika,
                3600000 = 1 saat.
              </div>

              <div className="admin-table-wrap">
                <table className="admin-entitlement-table">
                  <thead>
                    <tr>
                      <th>Limit</th>
                      <th>Maksimum</th>
                      <th>Pencere</th>
                      <th>Hata mesajı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([key, policy]) => (
                      <tr key={key}>
                        <td>
                          <strong>{policy.label}</strong>
                          <div className="admin-muted">{key}</div>
                        </td>
                        <td>
                          <input
                            className="admin-input"
                            type="number"
                            min={1}
                            value={policy.max}
                            onChange={(event) => updatePolicy(key, 'max', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="admin-input"
                            type="number"
                            min={1000}
                            step={1000}
                            value={policy.windowMs}
                            onChange={(event) => updatePolicy(key, 'windowMs', event.target.value)}
                          />
                          <div className="admin-muted">{formatWindow(policy.windowMs)}</div>
                        </td>
                        <td>
                          <input
                            className="admin-input"
                            type="text"
                            value={policy.message || ''}
                            onChange={(event) => updatePolicy(key, 'message', event.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="admin-card">
          <div className="admin-card-title">Limit Aşımı Güvenlik Logları</div>
          <div className="admin-muted">Son 50 API rate limit olayı listelenir.</div>
          <div className="admin-table-wrap">
            <table className="admin-entitlement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Policy</th>
                  <th>Kullanıcı</th>
                  <th>IP</th>
                  <th>Path</th>
                  <th>Sayım</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? (
                  events.map((event) => (
                    <tr key={event._id}>
                      <td>{formatDate(event.createdAt)}</td>
                      <td>{event.meta?.policy || '—'}</td>
                      <td>{event.userId || '—'}</td>
                      <td>{event.ip || '—'}</td>
                      <td>{event.method || ''} {event.path || '—'}</td>
                      <td>
                        {event.meta?.count || 0}/{event.meta?.limit || 0}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Henüz limit aşımı kaydı yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
