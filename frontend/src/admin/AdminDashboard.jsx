import { useCallback, useEffect, useMemo, useState } from 'react';
import adminApi from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';

const SUMMARY_TIMEOUT_MS = 10000;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR');
};

const resolveSummaryUrl = () => `${String(API_BASE_URL || '').replace(/\/$/, '')}/admin/dashboard/summary`;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [lastAttemptAt, setLastAttemptAt] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    setLastAttemptAt(new Date().toLocaleTimeString('tr-TR'));

    try {
      const response = await adminApi.get('/admin/dashboard/summary', {
        timeout: SUMMARY_TIMEOUT_MS
      });
      setSummary(response.data || null);
    } catch (err) {
      const timedOut = err?.code === 'ECONNABORTED';
      setSummary(null);
      setError(
        timedOut
          ? 'Ozet verisi zamaninda alinamadi. Baglanti veya backend yaniti gecikiyor olabilir.'
          : err?.response?.data?.message || 'Ozet verisi alinamadi.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const stats = useMemo(() => summary?.stats || {}, [summary]);
  const recentRfqs = summary?.recentRfqs || [];
  const moderationQueue = summary?.moderationQueue || [];
  const adminActions = summary?.recentAdminActions || [];
  const hasSummary = Boolean(summary);

  return (
    <div className="admin-dashboard">
      <h2>Gosterge Paneli</h2>

      <div className="admin-info">
        Ozet istegi: <strong>{resolveSummaryUrl()}</strong>
        <br />
        Timeout: <strong>{Math.round(SUMMARY_TIMEOUT_MS / 1000)} sn</strong>
        {lastAttemptAt ? (
          <>
            <br />
            Son deneme: <strong>{lastAttemptAt}</strong>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="admin-warning">
          <div>{error}</div>
          <div className="admin-action-row" style={{ marginTop: 12 }}>
            <button type="button" className="admin-btn" onClick={loadSummary} disabled={loading}>
              {loading ? 'Tekrar deneniyor...' : 'Tekrar dene'}
            </button>
          </div>
        </div>
      ) : null}

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
          <div className="admin-card-label">Yayindaki RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqActive ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Pasif / Reddedilen RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqPassive ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Toplam Kullanici</div>
          <div className="admin-card-value">{loading ? '...' : stats.userTotal ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Son 24 Saat Yeni Kullanici</div>
          <div className="admin-card-value">{loading ? '...' : stats.userLast24 ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Son 24 Saat Yeni RFQ</div>
          <div className="admin-card-value">{loading ? '...' : stats.rfqLast24 ?? 0}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Sistem Durumu</div>
          <div className="admin-card-value">{loading ? '...' : hasSummary ? 'Stabil' : 'Bekleniyor'}</div>
        </div>
      </div>

      <div className="admin-split-grid">
        <div className="admin-panel">
          <div className="admin-panel-title">Son eklenen RFQ'lar</div>
          <div className="admin-panel-body">
            {loading ? (
              <div className="admin-empty">Yukleniyor...</div>
            ) : recentRfqs.length === 0 ? (
              <div className="admin-empty">{error ? 'Ozet verisi bekleniyor.' : 'RFQ bulunamadi.'}</div>
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
          <div className="admin-panel-title">Moderasyon kuyrugu</div>
          <div className="admin-panel-body">
            {loading ? (
              <div className="admin-empty">Yukleniyor...</div>
            ) : moderationQueue.length === 0 ? (
              <div className="admin-empty">{error ? 'Ozet verisi bekleniyor.' : 'Bekleyen RFQ yok.'}</div>
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
        <div className="admin-panel-title">Son admin islemleri</div>
        <div className="admin-panel-body">
          {loading ? (
            <div className="admin-empty">Yukleniyor...</div>
          ) : adminActions.length === 0 ? (
            <div className="admin-empty">{error ? 'Ozet verisi bekleniyor.' : 'Kayit bulunamadi.'}</div>
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
