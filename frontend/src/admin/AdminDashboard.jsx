import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';
import { sanitizeAdminErrorMessage } from './adminErrorUtils';
import AdminDonutChart from './AdminDonutChart';

const SUMMARY_TIMEOUT_MS = 10000;
const USER_ROLE_PAGE_LIMIT = 1;
const USER_ROLE_KEYS = ['buyer', 'supplier', 'user', 'moderator', 'admin'];
const USER_ROLE_LABELS = {
  buyer: 'Alici',
  supplier: 'Hizmet Veren',
  user: 'Genel',
  moderator: 'Moderator',
  admin: 'Admin',
  other: 'Diger'
};

const CHART_COLORS = {
  pending: '#f39c12',
  active: '#007bff',
  passive: '#6c757d',
  buyer: '#17a2b8',
  supplier: '#28a745',
  user: '#6610f2',
  moderator: '#fd7e14',
  admin: '#dc3545',
  other: '#adb5bd'
};

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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState('');
  const [roleChartState, setRoleChartState] = useState({
    loading: false,
    error: '',
    segments: [],
    total: 0
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    setRefreshNotice('');
    setLastAttemptAt(new Date().toLocaleTimeString('tr-TR'));

    try {
      const response = await api.get('/admin/dashboard/summary', {
        timeout: SUMMARY_TIMEOUT_MS
      });
      setSummary(response.data || null);
    } catch (err) {
      const timedOut = err?.code === 'ECONNABORTED';
      setSummary(null);
      setError(
        timedOut
          ? 'Ozet verisi zamaninda alinamadi. Baglanti veya backend yaniti gecikiyor olabilir.'
          : sanitizeAdminErrorMessage(err, 'Ozet verisi alinamadi.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshNotice('');

    try {
      await api.post('/admin/dashboard/summary/refresh');
      setRefreshNotice('Dashboard yenileme istegi alindi. Guncel snapshot birazdan gorunecek.');
      setTimeout(() => {
        loadSummary();
      }, 1200);
    } catch (err) {
      setRefreshNotice(sanitizeAdminErrorMessage(err, 'Dashboard yenileme istegi gonderilemedi.'));
    } finally {
      setRefreshing(false);
    }
  }, [loadSummary]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadRoleDistribution = useCallback(async (userTotalHint) => {
    setRoleChartState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const responses = await Promise.all(
        USER_ROLE_KEYS.map((role) =>
          api.get('/admin/users', {
            params: { role, page: 1, limit: USER_ROLE_PAGE_LIMIT },
            timeout: SUMMARY_TIMEOUT_MS
          })
        )
      );

      const roleSegments = responses
        .map((response, index) => {
          const role = USER_ROLE_KEYS[index];
          const count = Number(response?.data?.pagination?.total || 0);
          return {
            key: role,
            label: USER_ROLE_LABELS[role] || role,
            value: count,
            color: CHART_COLORS[role] || CHART_COLORS.other
          };
        })
        .filter((segment) => segment.value > 0);

      const countedUsers = roleSegments.reduce((sum, segment) => sum + segment.value, 0);
      const userTotal = Math.max(Number(userTotalHint || 0), countedUsers);
      const otherUsers = Math.max(userTotal - countedUsers, 0);

      if (otherUsers > 0) {
        roleSegments.push({
          key: 'other',
          label: USER_ROLE_LABELS.other,
          value: otherUsers,
          color: CHART_COLORS.other
        });
      }

      setRoleChartState({
        loading: false,
        error: '',
        segments: roleSegments,
        total: userTotal
      });
    } catch (err) {
      setRoleChartState({
        loading: false,
        error: sanitizeAdminErrorMessage(err, 'Kullanici rol dagilimi alinamadi.'),
        segments: [],
        total: 0
      });
    }
  }, []);

  useEffect(() => {
    if (!loading && !error && Number(summary?.stats?.userTotal || 0) > 0) {
      loadRoleDistribution(summary?.stats?.userTotal);
    } else if (!loading && !error) {
      setRoleChartState({
        loading: false,
        error: '',
        segments: [],
        total: Number(summary?.stats?.userTotal || 0)
      });
    }
  }, [error, loadRoleDistribution, loading, summary]);

  const stats = useMemo(() => summary?.stats || {}, [summary]);
  const recentRfqs = summary?.recentRfqs || [];
  const moderationQueue = summary?.moderationQueue || [];
  const adminActions = summary?.recentAdminActions || [];
  const hasSummary = Boolean(summary);
  const rfqStatusSegments = useMemo(() => {
    const pending = Number(stats.rfqPending || 0);
    const passive = Number(stats.rfqPassive || 0);
    const openTotal = Number(stats.rfqActive || 0);
    const active = Math.max(openTotal - pending, 0);

    return [
      { label: 'Bekleyen', value: pending, color: CHART_COLORS.pending },
      { label: 'Yayinda', value: active, color: CHART_COLORS.active },
      { label: 'Pasif', value: passive, color: CHART_COLORS.passive }
    ].filter((segment) => segment.value > 0);
  }, [stats.rfqActive, stats.rfqPassive, stats.rfqPending]);

  const premiumChartState = useMemo(
    () => ({
      loading: false,
      error: '',
      segments: []
    }),
    []
  );

  return (
    <div className="admin-dashboard">
      <h2>Gosterge Paneli</h2>

      <div className="admin-info">
        Ozet istegi: <strong>{resolveSummaryUrl()}</strong>
        <br />
        Timeout: <strong>{Math.round(SUMMARY_TIMEOUT_MS / 1000)} sn</strong>
        <br />
        Son guncelleme:{' '}
        <strong>{summary?.computedAt ? formatDate(summary.computedAt) : 'Snapshot henuz olusmadi'}</strong>
        <br />
        Snapshot kaynagi: <strong>{summary?.source || 'bekleniyor'}</strong>
        {lastAttemptAt ? (
          <>
            <br />
            Son deneme: <strong>{lastAttemptAt}</strong>
          </>
        ) : null}
      </div>

      <div className="admin-action-row" style={{ marginBottom: 16 }}>
        <button type="button" className="admin-btn" onClick={loadSummary} disabled={loading}>
          {loading ? 'Yukleniyor...' : 'Ozeti Yeniden Yukle'}
        </button>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={triggerRefresh} disabled={refreshing}>
          {refreshing ? 'Yenileme isteniyor...' : 'Simdi Yenile'}
        </button>
      </div>

      {refreshNotice ? <div className="admin-info">{refreshNotice}</div> : null}

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

      <div className="admin-chart-grid">
        <AdminDonutChart
          title="RFQ durum dagilimi"
          subtitle="Bekleyen, yayindaki ve pasif talepler ayni snapshot uzerinden hesaplanir."
          segments={rfqStatusSegments}
          totalLabel="RFQ"
          loading={loading}
          error={error}
          emptyMessage="Durum dagilimi icin yeterli RFQ verisi bulunamadi."
          onRetry={loadSummary}
          note="Not: Bekleyen RFQ sayisi, acik RFQ toplamindan ayrilarak cakismasiz yuzdelere donusturuldu."
        />

        <AdminDonutChart
          title="Kullanici rol dagilimi"
          subtitle="Admin kullanici listesi uzerinden rol bazli toplamlar cekilir."
          segments={roleChartState.segments}
          totalLabel="Kullanici"
          loading={roleChartState.loading}
          error={roleChartState.error}
          emptyMessage="Rol dagilimi icin kullanici verisi bulunamadi."
          onRetry={() => loadRoleDistribution(summary?.stats?.userTotal)}
          note="Kaynak: /admin/users role filtreleri + toplam kullanici snapshot'i."
        />

        <AdminDonutChart
          title="Premium vs normal kullanici orani"
          subtitle="Bu alan yalniz mevcut admin endpoint'leri premium kullanici ayrimi donerse cizilir."
          segments={premiumChartState.segments}
          totalLabel="Kullanici"
          loading={premiumChartState.loading}
          error={premiumChartState.error}
          emptyMessage="Mevcut admin kullanici endpoint'i premium alanini donmedigi icin bu grafik su anda hesaplanamiyor."
          note="Sahte oran uretmedik. Bu grafik backend premium kullanici sayisini expose ettiginde otomatik baglanacak."
        />
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
