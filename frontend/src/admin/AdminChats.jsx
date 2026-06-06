import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/adminApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const statusLabel = (value) => {
  switch (value) {
    case 'active':
      return 'Aktif';
    case 'pending':
      return 'Beklemede';
    default:
      return value || '—';
  }
};

const moderationLabel = (value) => {
  switch (value) {
    case 'flagged':
      return 'Riskli';
    case 'clean':
      return 'Temiz';
    default:
      return value || '—';
  }
};

const participantsLabel = (participants = []) =>
  participants
    .map((item) => item?.name || item?.email)
    .filter(Boolean)
    .join(' / ') || '—';

const buildInitialFilters = (search = '') => {
  const params = new URLSearchParams(search || '');
  return {
    q: '',
    userId: '',
    rfqId: '',
    status: '',
    reportStatus: '',
    dateFrom: '',
    dateTo: '',
    hasReports: false,
    hasUnread: false,
    hasMedia: false,
    hasBlocked: false,
    hasRestricted: false,
    riskLevel: params.get('riskLevel') || ''
  };
};

export default function AdminChats() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => buildInitialFilters(location.search));

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const riskLevel = params.get('riskLevel') || '';
    setFilters((prev) => (prev.riskLevel === riskLevel ? prev : { ...prev, riskLevel }));
    setPage(1);
  }, [location.search]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 25);
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        if (value) params.set(key, 'true');
        return;
      }
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    const loadChats = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/chats?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Chat kayıtları alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadChats();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    if (key === 'riskLevel') {
      navigate(value ? `/admin/chats?riskLevel=${encodeURIComponent(value)}` : '/admin/chats', { replace: true });
    }
  };

  const resetFilters = () => {
    setFilters(buildInitialFilters(''));
    setPage(1);
    if (location.search) {
      navigate('/admin/chats', { replace: true });
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Chat Denetimi</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            value={filters.q}
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Kullanıcı, RFQ veya mesaj ara"
          />
          <input
            className="admin-input"
            value={filters.userId}
            onChange={(event) => updateFilter('userId', event.target.value)}
            placeholder="Kullanıcı ID"
          />
          <input
            className="admin-input"
            value={filters.rfqId}
            onChange={(event) => updateFilter('rfqId', event.target.value)}
            placeholder="RFQ ID"
          />
          <select className="admin-input" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Durum (tümü)</option>
            <option value="active">Aktif</option>
            <option value="pending">Beklemede</option>
          </select>
          <select className="admin-input" value={filters.riskLevel} onChange={(event) => updateFilter('riskLevel', event.target.value)}>
            <option value="">Risk seviyesi (tümü)</option>
            <option value="low">Düşük</option>
            <option value="medium">Orta</option>
            <option value="high">Yüksek</option>
          </select>
          <select className="admin-input" value={filters.reportStatus} onChange={(event) => updateFilter('reportStatus', event.target.value)}>
            <option value="">Şikayet durumu (tümü)</option>
            <option value="open">Açık</option>
            <option value="reviewed">İncelendi</option>
            <option value="dismissed">Geçersiz</option>
            <option value="action_taken">İşlem Yapıldı</option>
          </select>
          <input
            className="admin-input"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
          <input
            className="admin-input"
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
          <label className="admin-check">
            <input
              type="checkbox"
              checked={filters.hasReports}
              onChange={(event) => updateFilter('hasReports', event.target.checked)}
            />
            Şikayetli
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={filters.hasMedia}
              onChange={(event) => updateFilter('hasMedia', event.target.checked)}
            />
            Medya var
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={filters.hasBlocked}
              onChange={(event) => updateFilter('hasBlocked', event.target.checked)}
            />
            Engel var
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={filters.hasRestricted}
              onChange={(event) => updateFilter('hasRestricted', event.target.checked)}
            />
            Kısıtlı kullanıcı
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={filters.hasUnread}
              onChange={(event) => updateFilter('hasUnread', event.target.checked)}
            />
            Okunmamış var
          </label>
          <button type="button" className="admin-btn" onClick={resetFilters}>
            Filtreleri Temizle
          </button>
        </div>

        <div className="admin-active-filters">
          {Object.entries(filters).map(([key, value]) => {
            if (typeof value === 'boolean' ? !value : !value) return null;
            return (
              <span key={key} className="admin-filter-badge">
                {key}: {typeof value === 'boolean' ? 'aktif' : value}
              </span>
            );
          })}
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
          <div className="admin-table admin-chat-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Katılımcılar</div>
              <div>RFQ</div>
              <div>Son mesaj</div>
              <div>Şikayet</div>
              <div>Risk</div>
              <div>Durum</div>
              <div>Son aktivite</div>
              <div>Aksiyon</div>
            </div>
            {items.map((item) => (
              <div key={item.chatId} className="admin-table-row no-checkbox">
                <div>
                  <strong>{participantsLabel(item.participants)}</strong>
                  {item.hasBlockedParticipant ? <div className="admin-muted">Engel ilişkisi var</div> : null}
                </div>
                <div>{item.rfq?.title || '—'}</div>
                <div>
                  {item.lastMessagePreview || '—'}
                  {item.mediaMessageCount > 0 ? <div className="admin-muted">{item.mediaMessageCount} medya mesajı</div> : null}
                  {item.unreadTotal > 0 ? <div className="admin-muted">{item.unreadTotal} okunmamış</div> : null}
                </div>
                <div>{item.reportCount || 0}</div>
                <div>
                  {moderationLabel(item.moderationStatus)}
                  {item.flaggedMessageCount > 0 ? <div className="admin-muted">{item.flaggedMessageCount} mesaj</div> : null}
                </div>
                <div>{statusLabel(item.status)}</div>
                <div>{formatDate(item.lastMessageAt)}</div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => navigate(`/admin/chats/${item.chatId}`)}>
                    İncele
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
