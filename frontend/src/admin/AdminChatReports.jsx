import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/adminApi';

const statusLabel = (status) => {
  switch (status) {
    case 'open':
      return 'Açık';
    case 'reviewed':
      return 'İncelendi';
    case 'dismissed':
      return 'Geçersiz';
    case 'action_taken':
      return 'İşlem Yapıldı';
    default:
      return status || '—';
  }
};

const reasonLabel = (reason) => {
  switch (reason) {
    case 'spam':
      return 'Spam';
    case 'harassment':
      return 'Taciz';
    case 'inappropriate':
      return 'Uygunsuz';
    case 'scam':
      return 'Dolandırıcılık';
    case 'other':
      return 'Diğer';
    default:
      return reason || '—';
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminChatReports() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', reason: '' });
  const [updatingId, setUpdatingId] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page]);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/chat-reports?${queryParams}`);
      setItems(response.data?.items || []);
      setHasMore(Boolean(response.data?.pagination?.hasMore));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Chat şikayetleri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      await loadReports();
    };
    if (active) run();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError('');
    try {
      await api.patch(`/admin/chat-reports/${id}`, { status });
      setItems((prev) => prev.map((item) => (item._id === id ? { ...item, status } : item)));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Durum güncellenemedi.');
    } finally {
      setUpdatingId('');
    }
  };

  const onFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Chat Şikayetleri</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <select className="admin-input" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">Durum (tümü)</option>
            <option value="open">Açık</option>
            <option value="reviewed">İncelendi</option>
            <option value="dismissed">Geçersiz</option>
            <option value="action_taken">İşlem Yapıldı</option>
          </select>
          <select className="admin-input" value={filters.reason} onChange={(event) => onFilterChange('reason', event.target.value)}>
            <option value="">Neden (tümü)</option>
            <option value="spam">Spam</option>
            <option value="harassment">Taciz</option>
            <option value="inappropriate">Uygunsuz</option>
            <option value="scam">Dolandırıcılık</option>
            <option value="other">Diğer</option>
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
              <div>Neden</div>
              <div>Reporter</div>
              <div>Reported</div>
              <div>Talep</div>
              <div>Mesaj</div>
              <div>Durum</div>
              <div>Tarih</div>
              <div>Aksiyon</div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{reasonLabel(item.reason)}</div>
                <div>{item.reporterId?.name || item.reporterId?.email || '—'}</div>
                <div>{item.reportedUserId?.name || item.reportedUserId?.email || '—'}</div>
                <div>{item.rfqId?.title || '—'}</div>
                <div>{item.messageId?.content || item.note || 'Konuşma şikayeti'}</div>
                <div>
                  <select
                    className="admin-input"
                    value={item.status}
                    disabled={updatingId === item._id}
                    onChange={(event) => updateStatus(item._id, event.target.value)}
                  >
                    <option value="open">Açık</option>
                    <option value="reviewed">İncelendi</option>
                    <option value="dismissed">Geçersiz</option>
                    <option value="action_taken">İşlem Yapıldı</option>
                  </select>
                  <div className="admin-muted">{statusLabel(item.status)}</div>
                </div>
                <div>{formatDate(item.createdAt)}</div>
                <div>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => navigate(`/admin/chats/${item.chatId?._id || item.chatId}`)}
                    disabled={!item.chatId}
                  >
                    Konuşmayı İncele
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
