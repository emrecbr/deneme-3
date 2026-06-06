import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const userLabel = (user) => user?.name || user?.email || user?.id || '—';

const scopeLabel = (value) => {
  switch (value) {
    case 'platform':
      return 'Platform';
    case 'chat':
      return 'Chat';
    default:
      return value || '—';
  }
};

export default function AdminChatRestrictions() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 25);
    if (status) params.set('status', status);
    return params.toString();
  }, [page, status]);

  useEffect(() => {
    let active = true;
    const loadRestrictions = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/chat-restrictions?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Kısıtlı kullanıcılar alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRestrictions();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const removeRestriction = async (item) => {
    if (!item?.user?.id || !item?.restrictionId) return;
    setRemovingId(item.restrictionId);
    setError('');
    try {
      await api.delete(`/admin/users/${item.user.id}/chat-restrictions/${item.restrictionId}`);
      setItems((prev) => prev.filter((entry) => entry.restrictionId !== item.restrictionId));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Kısıtlama kaldırılamadı.');
    } finally {
      setRemovingId('');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Kısıtlı Kullanıcılar</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <select
            className="admin-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="active">Aktif kısıtlamalar</option>
            <option value="lifted">Kaldırılanlar</option>
            <option value="all">Tümü</option>
          </select>
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Kullanıcı</div>
              <div>Kapsam</div>
              <div>Neden</div>
              <div>Başlangıç</div>
              <div>Bitiş</div>
              <div>Durum</div>
              <div>Aksiyon</div>
            </div>
            {items.map((item) => (
              <div key={item.restrictionId} className="admin-table-row no-checkbox">
                <div>{userLabel(item.user)}</div>
                <div>{scopeLabel(item.scope)}</div>
                <div>{item.reason || '—'}</div>
                <div>{formatDate(item.createdAt)}</div>
                <div>{formatDate(item.expiresAt)}</div>
                <div>{item.active ? 'Aktif' : 'Pasif'}</div>
                <div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    disabled={!item.active || removingId === item.restrictionId}
                    onClick={() => removeRestriction(item)}
                  >
                    Kaldır
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
