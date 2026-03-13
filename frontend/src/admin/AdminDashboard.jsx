import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/dashboard/summary');
        if (!active) return;
        setSummary(response.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Dashboard verisi alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => summary?.stats || {}, [summary]);
  const recentRfqs = summary?.recentRfqs || [];
  const moderationQueue = summary?.moderationQueue || [];
  const adminActions = summary?.recentAdminActions || [];

  return (
    <div className="admin-dashboard">
      <h2>Gösterge Paneli</h2>
      {error ? <div className="admin-error">{error}</div> : null}
      <div className="admin-card-grid">
        <div className="admin-card">
          <div className="admin-card-label">Toplam RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqTotal ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Onay Bekleyen RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqPending ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Yayındaki RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqActive ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Pasif / Reddedilen RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqPassive ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Toplam Kullanıcı</div>
          <div className="admin-card-value">{loading ? '...' : stats.userTotal ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Son 24 Saat Yeni Kullanıcı</div>
          <div className="admin-card-value">{loading ? '...' : stats.userLast24 ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Son 24 Saat Yeni RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqLast24 ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Sistem Durumu</div>
          <div className="admin-card-value">Stabil</div>
        </div>
      </div>

      <div className="admin-split-grid">
        <div className="admin-panel">
          <div className="admin-panel-title">Son Eklenen RFQ’lar</div>
          <div className="admin-panel-body">
            {loading ? (
              <div className="admin-empty">Yükleniyor…</div>
            ) : recentRfqs.length === 0 ? (
              <div className="admin-empty">RFQ bulunamadı.</div>
            ) : (
              <ul className="admin-list">
                {recentRfqs.map((item) => (
                  <li key={item._id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="admin-muted">{item.status || 'open'}</span>
                    </div>
                    <span className="admin-muted">{formatDate(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-title">Moderasyon Kuyruğu</div>
          <div className="admin-panel-body">
            {loading ? (
              <div className="admin-empty">Yükleniyor…</div>
            ) : moderationQueue.length === 0 ? (
              <div className="admin-empty">Bekleyen RFQ yok.</div>
            ) : (
              <ul className="admin-list">
                {moderationQueue.map((item) => (
                  <li key={item._id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="admin-muted">{item.status || 'pending'}</span>
                    </div>
                    <span className="admin-muted">{formatDate(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-title">Son Admin İşlemleri</div>
        <div className="admin-panel-body">
          {loading ? (
            <div className="admin-empty">Yükleniyor…</div>
          ) : adminActions.length === 0 ? (
            <div className="admin-empty">Kayıt bulunamadı.</div>
          ) : (
            <ul className="admin-list">
              {adminActions.map((item) => (
                <li key={item._id}>
                  <div>
                    <strong>{item.action}</strong>
                    <span className="admin-muted">{item.role || '-'}</span>
                  </div>
                  <span className="admin-muted">{formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
