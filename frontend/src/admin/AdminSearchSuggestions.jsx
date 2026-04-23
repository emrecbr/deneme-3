import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const emptyForm = { term: '', categoryId: '', order: 0, isActive: true };

export default function AdminSearchSuggestions() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [suggestionsRes, categoriesRes] = await Promise.all([
        api.get('/admin/categories/search-suggestions?includeInactive=true'),
        api.get('/admin/categories?includeInactive=true')
      ]);
      setItems(suggestionsRes.data?.items || []);
      setCategories(categoriesRes.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Öneriler alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const submit = async () => {
    setMessage('');
    try {
      if (editingId) {
        await api.patch(`/admin/categories/search-suggestions/${editingId}`, form);
        setMessage('Öneri güncellendi.');
      } else {
        await api.post('/admin/categories/search-suggestions', form);
        setMessage('Öneri eklendi.');
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'İşlem başarısız.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      term: item.term || '',
      categoryId: item.category?._id || '',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Arama Öneri Kategorileri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            Terim
            <input className="admin-input" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
          </label>
          <label>
            Kategori
            <select className="admin-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Seçin</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </label>
          <label>
            Sıra
            <input className="admin-input" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
          </label>
          <label>
            Aktif
            <select className="admin-input" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={submit}>{editingId ? 'Güncelle' : 'Ekle'}</button>
          {message ? <span className="admin-muted">{message}</span> : null}
        </div>

        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Öneri bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Terim</div>
              <div>Kategori</div>
              <div>Sıra</div>
                <div>Aktif</div>
                <div>Gösterim</div>
                <div>Tıklama</div>
                <div></div>
              </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.term}</div>
                <div>{item.category?.name || '—'}</div>
                <div>{item.order ?? 0}</div>
                <div>{item.isActive === false ? 'Pasif' : 'Aktif'}</div>
                <div>{item.impressions ?? 0}</div>
                <div>{item.clicks ?? 0}</div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => startEdit(item)}>Düzenle</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
