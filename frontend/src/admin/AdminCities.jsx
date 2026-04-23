import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const emptyForm = {
  name: '',
  slug: '',
  isActive: true,
  radiusKm: '',
  areaKm2: '',
  lat: '',
  lng: ''
};

export default function AdminCities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/location/cities?includeInactive=true&page=${page}&limit=50`);
      setItems(response.data?.items || []);
      setHasMore(Boolean(response.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Şehirler alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, [page]);

  const submit = async () => {
    setMessage('');
    const payload = {
      name: form.name,
      slug: form.slug,
      isActive: form.isActive,
      radiusKm: form.radiusKm === '' ? undefined : Number(form.radiusKm),
      areaKm2: form.areaKm2 === '' ? undefined : Number(form.areaKm2),
      center: form.lat && form.lng ? { coordinates: [Number(form.lng), Number(form.lat)] } : undefined
    };
    try {
      if (editingId) {
        await api.patch(`/admin/location/cities/${editingId}`, payload);
        setMessage('Şehir güncellendi.');
      } else {
        await api.post('/admin/location/cities', payload);
        setMessage('Şehir eklendi.');
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
      isActive: item.isActive !== false,
      radiusKm: item.radiusKm ?? '',
      areaKm2: item.areaKm2 ?? '',
      lat: item.center?.coordinates?.[1] ?? '',
      lng: item.center?.coordinates?.[0] ?? ''
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Şehirler</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            Şehir Adı
            <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Slug
            <input className="admin-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <label>
            Aktif
            <select className="admin-input" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          </label>
          <label>
            Radius (km)
            <input className="admin-input" value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} />
          </label>
          <label>
            Alan (km2)
            <input className="admin-input" value={form.areaKm2} onChange={(e) => setForm({ ...form, areaKm2: e.target.value })} />
          </label>
          <label>
            Merkez Lat
            <input className="admin-input" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          </label>
          <label>
            Merkez Lng
            <input className="admin-input" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
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
          <div className="admin-empty">Şehir bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Ad</div>
              <div>Slug</div>
              <div>Aktif</div>
              <div>Merkez</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.name}</div>
                <div>{item.slug}</div>
                <div>{item.isActive === false ? 'Pasif' : 'Aktif'}</div>
                <div>
                  {item.center?.coordinates?.[1] ? `${item.center.coordinates[1]}, ${item.center.coordinates[0]}` : '—'}
                </div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => startEdit(item)}>Düzenle</button>
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
