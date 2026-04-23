import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminMaintenance() {
  const [mode, setMode] = useState(null);
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
        const response = await api.get('/admin/system/maintenance');
        if (!active) return;
        setMode(response.data?.data || { enabled: false, message: 'Sistem bakımda.' });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Bakım modu alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!mode) return;
    if (!window.confirm('Bakım modu güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/system/maintenance', mode);
      setMode(response.data?.data || mode);
      setSuccess('Bakım modu güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Bakım modu güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Bakım Modu</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !mode ? (
          <div className="admin-empty">Ayar bulunamadı.</div>
        ) : (
          <div className="admin-form-grid">
            <label>
              <span>Bakım modu aktif</span>
              <input
                type="checkbox"
                checked={Boolean(mode.enabled)}
                onChange={(event) => setMode((prev) => ({
                  ...(prev || {}),
                  enabled: event.target.checked
                }))}
              />
            </label>
            <label>
              <span>Bakım mesajı</span>
              <textarea
                className="admin-textarea"
                value={mode.message || ''}
                onChange={(event) => setMode((prev) => ({
                  ...(prev || {}),
                  message: event.target.value
                }))}
                rows={3}
              />
            </label>
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={handleSave} disabled={!mode || saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
