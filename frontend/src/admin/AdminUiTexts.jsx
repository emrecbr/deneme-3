import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminUiTexts() {
  const [form, setForm] = useState({
    searchHint: '',
    emptyCityTitle: '',
    emptyCityDescription: ''
  });
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
        const response = await api.get('/admin/content/ui-texts');
        if (!active) return;
        setForm(response.data?.data || form);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'UI metinleri alınamadı.');
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
    if (!window.confirm('UI metinleri güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/content/ui-texts', form);
      setForm(response.data?.data || form);
      setSuccess('UI metinleri güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'UI metinleri güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Arayüz Metinleri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <div className="admin-form-grid">
            <label>
              <span>Arama paneli hint</span>
              <input className="admin-input" value={form.searchHint || ''} onChange={(e) => setForm({ ...form, searchHint: e.target.value })} />
            </label>
            <label>
              <span>Şehir seçilmedi başlık</span>
              <input className="admin-input" value={form.emptyCityTitle || ''} onChange={(e) => setForm({ ...form, emptyCityTitle: e.target.value })} />
            </label>
            <label>
              <span>Şehir seçilmedi açıklama</span>
              <textarea className="admin-textarea" rows={2} value={form.emptyCityDescription || ''} onChange={(e) => setForm({ ...form, emptyCityDescription: e.target.value })} />
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
