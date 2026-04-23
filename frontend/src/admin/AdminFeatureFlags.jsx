import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

const FLAG_DEFS = [
  {
    key: 'mapViewEnabled',
    label: 'Harita gorunumu',
    description: 'RFQ listeleme ekraninda harita sekmesini ve harita tabanli gosterimi kontrol eder.'
  },
  {
    key: 'searchPanelEnabled',
    label: 'Yeni arama paneli',
    description: 'Filtre ve arama alanlarinin yeni panel duzeniyle gosterilmesini belirler.'
  },
  {
    key: 'liveLocationEnabled',
    label: 'Canli konum filtresi',
    description: 'Kullanicinin anlik konumuna dayali filtreleme ve yakin cevre akisini kontrol eder.'
  },
  {
    key: 'cityFallbackEnabled',
    label: 'Sehir fallback mantigi',
    description: 'Reverse geocoding eksik kalirsa sehir tabanli yedek cozum akisini devreye alir.'
  }
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
        setError(err?.response?.data?.message || 'Feature flag listesi alinamadi.');
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
    if (!window.confirm('Feature flag degisiklikleri uygulamayi etkiler. Devam edilsin mi?')) {
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
      setError(err?.response?.data?.message || 'Feature flag guncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Feature Flags</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu ayarlar canli davranisi aninda etkiler. Kaydetmeden once hangi ozelligin aktif, hangisinin pasif
          oldugunu asagidaki durum rozetlerinden net olarak kontrol edin.
        </div>
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yukleniyor...</div>
        ) : !flags ? (
          <div className="admin-empty">Ayar bulunamadi.</div>
        ) : (
          <div className="admin-flag-list">
            {flagEntries.map((item) => (
              <label
                key={item.key}
                className={`admin-flag-row ${item.value ? 'is-enabled' : 'is-disabled'}`}
              >
                <div className="admin-flag-copy">
                  <span className="admin-flag-title">{item.label}</span>
                  <span className="admin-flag-description">{item.description}</span>
                </div>
                <div className="admin-flag-control">
                  <span className={`admin-status-pill ${item.value ? 'is-healthy' : 'is-error'}`}>
                    {item.value ? 'Aktif' : 'Pasif'}
                  </span>
                  <span className="admin-flag-switch">
                    <input
                      type="checkbox"
                      checked={item.value}
                      onChange={() => handleToggle(item.key)}
                    />
                    <span className="admin-flag-slider" aria-hidden="true" />
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={handleSave} disabled={!flags || saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
