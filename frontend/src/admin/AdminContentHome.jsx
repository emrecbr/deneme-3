import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminContentHome() {
  const [form, setForm] = useState({ heroTitle: '', heroSubtitle: '' });
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
        const response = await api.get('/admin/content/home');
        if (!active) return;
        setForm(response.data?.data || { heroTitle: '', heroSubtitle: '' });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'İçerik alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (!window.confirm('İçerik güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/content/home', form);
      setForm(response.data?.data || form);
      setSuccess('İçerik güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'İçerik güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Ana Sayfa İçerikleri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <div className="admin-form-grid">
            <label>
              <span>Başlık</span>
              <input className="admin-input" value={form.heroTitle || ''} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
            </label>
            <label>
              <span>Alt başlık</span>
              <textarea className="admin-textarea" rows={3} value={form.heroSubtitle || ''} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
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
