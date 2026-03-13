import { useEffect, useState } from 'react';
import api from '../api/axios';

const emptyForm = {
  name: '',
  slug: '',
  order: 0,
  isActive: true,
  parent: ''
};

export default function AdminSubcategories() {
  const [items, setItems] = useState([]);
  const [parents, setParents] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [subsRes, parentRes] = await Promise.all([
        api.get(`/admin/categories?parent=any&includeInactive=true&page=${page}&limit=50`),
        api.get('/admin/categories?parent=none&includeInactive=true')
      ]);
      setItems(subsRes.data?.items || []);
      setParents(parentRes.data?.items || []);
      setHasMore(Boolean(subsRes.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Alt kategori listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const submit = async () => {
    setMessage('');
    try {
      if (!form.parent) {
        setMessage('Parent kategori seçin.');
        return;
      }
      if (editingId) {
        await api.patch(`/admin/categories/${editingId}`, form);
        setMessage('Alt kategori güncellendi.');
      } else {
        await api.post('/admin/categories', form);
        setMessage('Alt kategori eklendi.');
      }
      setForm(emptyForm);
      setEditingId(null);
      setPage(1);
      load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'İşlem başarısız.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      order: item.order || 0,
      isActive: item.isActive !== false,
      parent: typeof item.parent === 'object' ? item.parent?._id : item.parent
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Alt Kategoriler</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            Alt Kategori Adı
            <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Slug
            <input className="admin-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <label>
            Parent Kategori
            <select className="admin-input" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
              <option value="">Seçin</option>
              {parents.map((parent) => (
                <option key={parent._id} value={parent._id}>{parent.name}</option>
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
          <button type="button" className="admin-btn" onClick={submit}>
            {editingId ? 'Güncelle' : 'Ekle'}
          </button>
          {message ? <span className="admin-muted">{message}</span> : null}
        </div>

        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Alt kategori bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Ad</div>
              <div>Parent</div>
              <div>Slug</div>
              <div>Sıra</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.name}</div>
                <div>{parents.find((p) => String(p._id) === String(item.parent))?.name || '—'}</div>
                <div>{item.slug}</div>
                <div>{item.order ?? 0}</div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => startEdit(item)}>
                    Düzenle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="admin-pagination">
          <button type="button" className="admin-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
            Önceki
          </button>
          <span className="admin-muted">Sayfa {page}</span>
          <button type="button" className="admin-btn" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
