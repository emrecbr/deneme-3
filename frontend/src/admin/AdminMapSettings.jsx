import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const DEFAULT_SETTINGS = {
  mapViewEnabled: true,
  defaultCenter: { lat: 41.0082, lng: 28.9784 },
  defaultZoom: 11,
  minZoom: 6,
  maxZoom: 18,
  clusterEnabled: true,
  radiusCircleEnabled: true,
  controlsEnabled: true
};

export default function AdminMapSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/map/settings');
        if (!active) return;
        setSettings({ ...DEFAULT_SETTINGS, ...(response.data?.data || {}) });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Harita ayarları alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateField = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateCenter = (field, value) => {
    const num = Number(value);
    setSettings((prev) => ({
      ...prev,
      defaultCenter: { ...prev.defaultCenter, [field]: Number.isFinite(num) ? num : prev.defaultCenter[field] }
    }));
  };

  const save = async () => {
    if (!window.confirm('Harita ayarları güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/map/settings', settings);
      setSettings({ ...DEFAULT_SETTINGS, ...(response.data?.data || settings) });
      setSuccess('Harita ayarları güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Harita ayarları güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Harita Ayarları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <div className="admin-form-grid">
            <label>
              <span>Harita görünümü aktif</span>
              <input type="checkbox" checked={settings.mapViewEnabled} onChange={(e) => updateField('mapViewEnabled', e.target.checked)} />
            </label>
            <label>
              <span>Default zoom</span>
              <input className="admin-input" type="number" value={settings.defaultZoom} onChange={(e) => updateField('defaultZoom', Number(e.target.value))} />
            </label>
            <label>
              <span>Min zoom</span>
              <input className="admin-input" type="number" value={settings.minZoom} onChange={(e) => updateField('minZoom', Number(e.target.value))} />
            </label>
            <label>
              <span>Max zoom</span>
              <input className="admin-input" type="number" value={settings.maxZoom} onChange={(e) => updateField('maxZoom', Number(e.target.value))} />
            </label>
            <label>
              <span>Default center lat</span>
              <input className="admin-input" type="number" value={settings.defaultCenter?.lat ?? ''} onChange={(e) => updateCenter('lat', e.target.value)} />
            </label>
            <label>
              <span>Default center lng</span>
              <input className="admin-input" type="number" value={settings.defaultCenter?.lng ?? ''} onChange={(e) => updateCenter('lng', e.target.value)} />
            </label>
            <label>
              <span>Cluster açık</span>
              <input type="checkbox" checked={settings.clusterEnabled} onChange={(e) => updateField('clusterEnabled', e.target.checked)} />
            </label>
            <label>
              <span>Yarıçap circle görünür</span>
              <input type="checkbox" checked={settings.radiusCircleEnabled} onChange={(e) => updateField('radiusCircleEnabled', e.target.checked)} />
            </label>
            <label>
              <span>Harita üstü kontroller</span>
              <input type="checkbox" checked={settings.controlsEnabled} onChange={(e) => updateField('controlsEnabled', e.target.checked)} />
            </label>
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={save} disabled={loading || saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
