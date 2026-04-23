import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const SEGMENT_OPTIONS = [
  { value: '', label: 'Tüm segmentler / Belirtilmedi' },
  { value: 'goods', label: 'Esya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

const emptyForm = {
  name: '',
  slug: '',
  order: 0,
  isActive: true,
  segment: ''
};

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');

  const getSegmentLabel = (value) =>
    SEGMENT_OPTIONS.find((item) => item.value === String(value || ''))?.label || 'Belirtilmedi';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        parent: 'none',
        includeInactive: 'true',
        page: String(page),
        limit: '50'
      });
      if (segmentFilter) {
        params.set('segment', segmentFilter);
      }
      const response = await api.get(`/admin/categories?${params.toString()}`);
      setItems(response.data?.items || []);
      setHasMore(Boolean(response.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Kategori listesi alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, segmentFilter]);

  const submit = async () => {
    setMessage('');
    try {
      const payload = { ...form, parent: null };
      if (editingId) {
        await api.patch(`/admin/categories/${editingId}`, payload);
        setMessage('Kategori guncellendi.');
      } else {
        await api.post('/admin/categories', payload);
        setMessage('Kategori eklendi.');
      }
      setForm(emptyForm);
      setEditingId(null);
      setPage(1);
      load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Islem basarisiz.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      order: item.order || 0,
      isActive: item.isActive !== false,
      segment: item.segment || ''
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Ana Kategoriler</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-filter-grid">
          <label>
            Segment Filtresi
            <select
              className="admin-input"
              value={segmentFilter}
              onChange={(e) => {
                setSegmentFilter(e.target.value);
                setPage(1);
              }}
            >
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Kategori Adi
            <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Slug
            <input className="admin-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <label>
            Segment
            <select className="admin-input" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sira
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
          <div className="admin-empty">Yükleniyor...</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Ad</div>
              <div>Segment</div>
              <div>Slug</div>
              <div>Sira</div>
              <div>Aktif</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.name}</div>
                <div>{getSegmentLabel(item.segment)}</div>
                <div>{item.slug}</div>
                <div>{item.order ?? 0}</div>
                <div>{item.isActive === false ? 'Pasif' : 'Aktif'}</div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => startEdit(item)}>
                    Duzenle
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
