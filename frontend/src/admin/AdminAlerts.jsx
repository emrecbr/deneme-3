import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const typeLabel = (value) => {
  switch (value) {
    case 'category':
      return 'Kategori';
    case 'category_city':
      return 'Kategori + Şehir';
    case 'category_city_district':
      return 'Kategori + Şehir + İlçe';
    case 'keyword':
      return 'Anahtar Kelime';
    default:
      return value || '—';
  }
};

export default function AdminAlerts() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ type: '', active: '', keyword: '' });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/alerts?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Takip listesi alinamadi.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const onFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Takip Bildirimleri</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <select className="admin-input" value={filters.type} onChange={(event) => onFilterChange('type', event.target.value)}>
            <option value="">Tip (tümü)</option>
            <option value="category">Kategori</option>
            <option value="category_city">Kategori + Şehir</option>
            <option value="category_city_district">Kategori + Şehir + İlçe</option>
            <option value="keyword">Anahtar Kelime</option>
          </select>
          <select className="admin-input" value={filters.active} onChange={(event) => onFilterChange('active', event.target.value)}>
            <option value="">Aktiflik (tümü)</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
          <input
            className="admin-input"
            placeholder="Anahtar kelime ara"
            value={filters.keyword}
            onChange={(event) => onFilterChange('keyword', event.target.value)}
          />
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Takip kaydı bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Kullanıcı</div>
              <div>Tip</div>
              <div>Kategori</div>
              <div>Şehir</div>
              <div>İlçe</div>
              <div>Keyword</div>
              <div>Aktif</div>
              <div>Son tetiklenme</div>
              <div>Oluşturma</div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.user?.name || item.user?.email || '—'}</div>
                <div>{typeLabel(item.type)}</div>
                <div>{item.categoryName || '—'}</div>
                <div>{item.cityName || '—'}</div>
                <div>{item.districtName || '—'}</div>
                <div>{item.keyword || '—'}</div>
                <div>{item.isActive ? 'Aktif' : 'Pasif'}</div>
                <div>{formatDate(item.lastTriggeredAt)}</div>
                <div>{formatDate(item.createdAt)}</div>
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
