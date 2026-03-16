import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminRfqExpired() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    if (query) params.set('q', query);
    return params.toString();
  }, [page, query]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/rfqs/expired?${queryParams}`);
      const nextItems = response.data?.items || [];
      setItems(nextItems);
      setHasMore(Boolean(response.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'RFQ listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await load();
    };
    run();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const restoreRfq = async (id) => {
    if (!window.confirm('Bu ilanı tekrar yayına almak istiyor musun?')) return;
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/restore`);
      setActionMessage('RFQ yeniden yayına alındı.');
      await load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Geri alma başarısız.');
    }
  };

  const deleteRfq = async (id) => {
    if (!window.confirm('Bu ilanı kalıcı olarak kaldırmak istiyor musun?')) return;
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/delete`);
      setActionMessage('RFQ kaldırıldı.');
      await load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Silme başarısız.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Süresi Dolan RFQ’lar</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            placeholder="RFQ ara (başlık/açıklama)"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {actionMessage ? <div className="admin-muted">{actionMessage}</div> : null}
        {error ? <div className="admin-error">{error}</div> : null}

        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Süresi dolan RFQ bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Başlık</div>
              <div>Kullanıcı</div>
              <div>Bitiş</div>
              <div></div>
            </div>
            {items.map((rfq) => (
              <div key={rfq._id} className="admin-table-row no-checkbox">
                <div>{rfq.title}</div>
                <div>{rfq.buyer?.email || '—'}</div>
                <div>{formatDate(rfq.expiredAt || rfq.expiresAt)}</div>
                <div className="admin-row-actions">
                  <Link to={`/admin/rfq/${rfq._id}`} className="admin-link">
                    Detay
                  </Link>
                  <button type="button" className="admin-link" onClick={() => restoreRfq(rfq._id)}>
                    Geri Aç
                  </button>
                  <button type="button" className="admin-link" onClick={() => deleteRfq(rfq._id)}>
                    Sil
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
