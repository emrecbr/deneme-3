import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const EVENT_LABELS = {
  sms_otp_send: 'SMS OTP gonderimi',
  sms_otp_verify: 'SMS OTP dogrulama',
  phone_otp_send: 'Telefon OTP gonderimi',
  phone_otp_verify: 'Telefon OTP dogrulama',
  otp_send: 'OTP gonderimi',
  otp_verify: 'OTP dogrulama',
  register_otp_send: 'Kayit OTP gonderimi',
  register_otp_verify: 'Kayit OTP dogrulama'
};

const STATUS_LABELS = {
  success: 'Basarili',
  failed: 'Basarisiz'
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const formatEvent = (value) => EVENT_LABELS[value] || value || '—';
const formatStatus = (value) => STATUS_LABELS[value] || value || '—';

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
        setError(err?.response?.data?.message || 'SMS loglari alinamadi.');
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
      <div className="admin-panel-title">SMS Loglari</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu ekran dogrudan `/admin/notifications/sms-logs` endpointinden gelir. Listede kayit varsa SMS akisinda
          olusan gercek denemeleri goruyorsun.
        </div>
        <div className="admin-filter-grid">
          <select className="admin-input" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }}>
            <option value="">Islem turu</option>
            {Object.keys(EVENT_LABELS).map((key) => (
              <option key={key} value={key}>{EVENT_LABELS[key]}</option>
            ))}
          </select>
          <input className="admin-input" placeholder="Hedef ara (telefon)" value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }} />
          <select className="admin-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Durum</option>
            <option value="success">Basarili</option>
            <option value="failed">Basarisiz</option>
          </select>
          <input className="admin-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <input className="admin-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        {error ? <div className="admin-error">{error}</div> : null}
        {!loading && items.length ? (
          <div className="admin-success">Gercek veri yansitiliyor: {items.length} SMS kaydi bulundu.</div>
        ) : null}
        {loading ? (
          <div className="admin-empty">Yukleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Log bulunamadi.</div>
        ) : (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{formatEvent(item.event)}</strong>
                  <span className={`admin-status-pill ${item.status === 'failed' ? 'is-error' : 'is-healthy'}`}>
                    {formatStatus(item.status)}
                  </span>
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
            Onceki
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
