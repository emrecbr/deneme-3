import { useEffect, useMemo, useState } from 'react';
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
  parent: '',
  segment: ''
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
  const [segmentFilter, setSegmentFilter] = useState('');

  const getSegmentLabel = (value) =>
    SEGMENT_OPTIONS.find((item) => item.value === String(value || ''))?.label || 'Belirtilmedi';

  const parentMap = useMemo(
    () => new Map(parents.map((parent) => [String(parent._id), parent])),
    [parents]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const listParams = new URLSearchParams({
        parent: 'any',
        includeInactive: 'true',
        page: String(page),
        limit: '50'
      });
      const parentParams = new URLSearchParams({
        parent: 'none',
        includeInactive: 'true'
      });
      if (segmentFilter) {
        listParams.set('segment', segmentFilter);
        parentParams.set('segment', segmentFilter);
      }

      const [subsRes, parentRes] = await Promise.all([
        api.get(`/admin/categories?${listParams.toString()}`),
        api.get(`/admin/categories?${parentParams.toString()}`)
      ]);
      setItems(subsRes.data?.items || []);
      setParents(parentRes.data?.items || []);
      setHasMore(Boolean(subsRes.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Alt kategori listesi alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, segmentFilter]);

  useEffect(() => {
    if (!form.parent) {
      return;
    }
    const parentItem = parentMap.get(String(form.parent));
    if (!parentItem) {
      return;
    }
    const parentSegment = String(parentItem.segment || '');
    if (parentSegment && form.segment !== parentSegment) {
      setForm((prev) => ({ ...prev, segment: parentSegment }));
    }
  }, [form.parent, form.segment, parentMap]);

  const submit = async () => {
    setMessage('');
    try {
      if (!form.parent) {
        setMessage('Parent kategori secin.');
        return;
      }
      const payload = { ...form };
      if (editingId) {
        await api.patch(`/admin/categories/${editingId}`, payload);
        setMessage('Alt kategori guncellendi.');
      } else {
        await api.post('/admin/categories', payload);
        setMessage('Alt kategori eklendi.');
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
      parent: typeof item.parent === 'object' ? item.parent?._id : item.parent,
      segment: item.segment || ''
    });
  };

  const availableParents = segmentFilter
    ? parents.filter((parent) => String(parent.segment || '') === segmentFilter)
    : parents;

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Alt Kategoriler</div>
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
            Alt Kategori Adi
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
              {availableParents.map((parent) => (
                <option key={parent._id} value={parent._id}>
                  {parent.name} ({getSegmentLabel(parent.segment)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Segment
            <select
              className="admin-input"
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value })}
              disabled={Boolean(form.parent && parentMap.get(String(form.parent))?.segment)}
            >
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
        ) : items.length === 0 ? (
          <div className="admin-empty">Alt kategori bulunamadi.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Ad</div>
              <div>Segment</div>
              <div>Parent</div>
              <div>Slug</div>
              <div>Sira</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.name}</div>
                <div>{getSegmentLabel(item.segment)}</div>
                <div>{parentMap.get(String(typeof item.parent === 'object' ? item.parent?._id : item.parent))?.name || '—'}</div>
                <div>{item.slug}</div>
                <div>{item.order ?? 0}</div>
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
