import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const FLAG_DEFS = [
  { key: 'mapViewEnabled', label: 'Harita görünümü' },
  { key: 'searchPanelEnabled', label: 'Yeni arama paneli' },
  { key: 'liveLocationEnabled', label: 'Canlı konum filtresi' },
  { key: 'cityFallbackEnabled', label: 'Şehir fallback mantığı' }
];

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flagEntries = useMemo(() => {
    if (!flags) return [];
    return FLAG_DEFS.map((def) => ({
      ...def,
      value: flags[def.key] !== false
    }));
  }, [flags]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/system/feature-flags');
        if (!active) return;
        setFlags(response.data?.data || {});
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Feature flag listesi alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = (key) => {
    setFlags((prev) => ({
      ...(prev || {}),
      [key]: prev?.[key] === false
    }));
  };

  const handleSave = async () => {
    if (!flags) return;
    if (!window.confirm('Feature flag değişiklikleri uygulamayı etkiler. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      FLAG_DEFS.forEach((def) => {
        payload[def.key] = flags[def.key] !== false;
      });
      const response = await api.patch('/admin/system/feature-flags', payload);
      setFlags(response.data?.data || payload);
      setSuccess('Ayarlar kaydedildi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Feature flag güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Feature Flags</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !flags ? (
          <div className="admin-empty">Ayar bulunamadı.</div>
        ) : (
          <div className="admin-flag-list">
            {flagEntries.map((item) => (
              <label key={item.key} className="admin-flag-row">
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.value}
                  onChange={() => handleToggle(item.key)}
                />
              </label>
            ))}
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={handleSave} disabled={!flags || saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
