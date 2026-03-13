import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminSmsLogs() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [event, setEvent] = useState('');
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    if (status) params.set('status', status);
    if (event) params.set('event', event);
    if (target) params.set('target', target);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [event, from, page, status, target, to]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/notifications/sms-logs?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'SMS logları alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [queryParams]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">SMS Logları</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input className="admin-input" placeholder="Event (sms_otp_send, phone_otp_send)" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} />
          <input className="admin-input" placeholder="Target ara" value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }} />
          <input className="admin-input" placeholder="Status (success/failed)" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
          <input className="admin-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <input className="admin-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Log bulunamadı.</div>
        ) : (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{item.event}</strong>
                  <span className="admin-muted">{item.status}</span>
                  <span className="admin-muted">{item.maskedTarget || item.target}</span>
                </div>
                <span className="admin-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
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
