import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminModerationSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/admin/system/moderation-settings');
        setSettings(response.data?.data || null);
      } catch (err) {
        setError(err?.response?.data?.message || 'Ayarlar alınamadı.');
      }
    };
    load();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      const response = await api.patch('/admin/system/moderation-settings', settings);
      setSettings(response.data?.data || settings);
    } catch (err) {
      setError(err?.response?.data?.message || 'Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="admin-panel">
        <div className="admin-panel-title">Gelişmiş Moderasyon Ayarları</div>
        <div className="admin-panel-body">{error ? <div className="admin-error">{error}</div> : 'Yükleniyor…'}</div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Gelişmiş Moderasyon Ayarları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            <span>Telefon filtresi</span>
            <select
              value={settings.phoneFilterEnabled ? 'true' : 'false'}
              onChange={(event) => handleChange('phoneFilterEnabled', event.target.value === 'true')}
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Link filtresi</span>
            <select
              value={settings.linkFilterEnabled ? 'true' : 'false'}
              onChange={(event) => handleChange('linkFilterEnabled', event.target.value === 'true')}
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Obfuscation filtresi</span>
            <select
              value={settings.obfuscationEnabled ? 'true' : 'false'}
              onChange={(event) => handleChange('obfuscationEnabled', event.target.value === 'true')}
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Tekrar içerik filtresi</span>
            <select
              value={settings.repeatFilterEnabled ? 'true' : 'false'}
              onChange={(event) => handleChange('repeatFilterEnabled', event.target.value === 'true')}
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Review eşiği</span>
            <input
              type="number"
              value={settings.reviewThreshold || 0}
              onChange={(event) => handleChange('reviewThreshold', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Block eşiği</span>
            <input
              type="number"
              value={settings.blockThreshold || 0}
              onChange={(event) => handleChange('blockThreshold', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Tekrar penceresi (saat)</span>
            <input
              type="number"
              value={settings.repeatWindowHours || 24}
              onChange={(event) => handleChange('repeatWindowHours', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Tekrar limit</span>
            <input
              type="number"
              value={settings.repeatLimit || 2}
              onChange={(event) => handleChange('repeatLimit', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
