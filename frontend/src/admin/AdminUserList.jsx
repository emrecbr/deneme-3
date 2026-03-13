import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminUserList({ defaultStatus = '' }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: defaultStatus });

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
        const response = await api.get(`/admin/users?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Kullanıcı listesi alınamadı.');
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
      <div className="admin-panel-title">Kullanıcı Yönetimi</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            placeholder="Kullanıcı ara (isim/email/telefon)"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Rol (buyer/supplier/admin/moderator)"
            value={filters.role}
            onChange={(event) => onFilterChange('role', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Durum (active/passive/blocked)"
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
          />
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kullanıcı bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>İsim</div>
              <div>Email</div>
              <div>Rol</div>
              <div>Durum</div>
              <div>Son giriş</div>
              <div></div>
            </div>
            {items.map((user) => (
              <div key={user._id} className="admin-table-row no-checkbox">
                <div>{user.name || '—'}</div>
                <div>{user.email || '—'}</div>
                <div>{user.role}</div>
                <div>
                  {user.isDeleted ? 'blocked' : user.isActive ? 'active' : 'passive'}
                </div>
                <div>{formatDate(user.lastLoginAt)}</div>
                <div>
                  <Link to={`/admin/users/${user._id}`} className="admin-link">
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
