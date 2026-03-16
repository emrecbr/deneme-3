import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const statusLabel = (status) => {
  switch (status) {
    case 'new':
      return 'Yeni';
    case 'under_review':
      return 'İncelemede';
    case 'resolved':
      return 'Çözüldü';
    case 'rejected':
      return 'Geçersiz';
    case 'closed':
      return 'Kapalı';
    default:
      return status || '—';
  }
};

export default function AdminIssueReports() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    sourceType: '',
    reporter: '',
    reported: '',
    rfq: ''
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key === 'rfq' ? 'rfqId' : key, value);
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/reports/issues?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Sorun bildirimi listesi alınamadı.');
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
      <div className="admin-panel-title">Sorun Bildirimleri</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            placeholder="Başlık/açıklama ara"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
          />
          <select className="admin-input" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">Durum (tümü)</option>
            <option value="new">Yeni</option>
            <option value="under_review">İncelemede</option>
            <option value="resolved">Çözüldü</option>
            <option value="rejected">Geçersiz</option>
            <option value="closed">Kapalı</option>
          </select>
          <select className="admin-input" value={filters.sourceType} onChange={(event) => onFilterChange('sourceType', event.target.value)}>
            <option value="">Kaynak (tümü)</option>
            <option value="rfq">RFQ</option>
            <option value="profile">Profil</option>
          </select>
          <input
            className="admin-input"
            placeholder="Şikayet eden (email/isim/id)"
            value={filters.reporter}
            onChange={(event) => onFilterChange('reporter', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Şikayet edilen (email/isim/id)"
            value={filters.reported}
            onChange={(event) => onFilterChange('reported', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="RFQ ID"
            value={filters.rfq}
            onChange={(event) => onFilterChange('rfq', event.target.value)}
          />
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Başlık</div>
              <div>Reporter</div>
              <div>Reported</div>
              <div>Kaynak</div>
              <div>Durum</div>
              <div>Tarih</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.title}</div>
                <div>{item.reporterUserId?.name || item.reporterUserId?.email || '—'}</div>
                <div>{item.reportedUserId?.name || item.reportedUserId?.email || '—'}</div>
                <div>{item.sourceType === 'rfq' ? 'RFQ' : 'Profil'}</div>
                <div>{statusLabel(item.status)}</div>
                <div>{formatDate(item.createdAt)}</div>
                <div>
                  <Link to={`/admin/reports/issues/${item._id}`} className="admin-link">
                    Detay
                  </Link>
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
