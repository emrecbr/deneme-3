import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const EVENT_LABELS = {
  otp_send: 'OTP gönderimi',
  otp_verify: 'OTP doğrulama',
  login_otp_send: 'Giriş OTP gönderimi',
  login_otp_verify: 'Giriş OTP doğrulama',
  register_otp_send: 'Kayıt OTP gönderimi',
  register_otp_verify: 'Kayıt OTP doğrulama',
  phone_otp_send: 'Telefon OTP gönderimi',
  phone_otp_verify: 'Telefon OTP doğrulama'
};

const STATUS_LABELS = {
  success: 'Başarılı',
  failed: 'Başarısız'
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const formatEvent = (value) => EVENT_LABELS[value] || value || '—';
const formatStatus = (value) => STATUS_LABELS[value] || value || '—';

export default function AdminOtpLogs() {
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
        const response = await api.get(`/admin/notifications/otp-logs?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'OTP logları alınamadı.');
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
      <div className="admin-panel-title">OTP Logları</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <select className="admin-input" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }}>
            <option value="">İşlem türü</option>
            {Object.keys(EVENT_LABELS).map((key) => (
              <option key={key} value={key}>{EVENT_LABELS[key]}</option>
            ))}
          </select>
          <input className="admin-input" placeholder="Hedef ara (email)" value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }} />
          <select className="admin-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Durum</option>
            <option value="success">Başarılı</option>
            <option value="failed">Başarısız</option>
          </select>
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
                  <strong>{formatEvent(item.event)}</strong>
                  <span className="admin-muted">{formatStatus(item.status)}</span>
                  <span className="admin-muted">{item.maskedTarget || item.target || '—'}</span>
                  {item.provider ? <span className="admin-muted">{item.provider}</span> : null}
                </div>
                {item.errorMessage ? <div className="admin-error">{item.errorMessage}</div> : null}
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
