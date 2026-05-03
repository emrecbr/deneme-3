import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';
import { sanitizeAdminErrorMessage } from './adminErrorUtils';

const SUMMARY_TIMEOUT_MS = 10000;
const USER_ROLE_PAGE_LIMIT = 1;
const USER_ROLE_KEYS = ['buyer', 'supplier', 'user', 'moderator', 'admin'];
const USER_ROLE_LABELS = {
  buyer: 'buyer',
  supplier: 'seller',
  user: 'genel',
  moderator: 'moderator',
  admin: 'Admin',
  other: 'Diger'
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR');
};

const formatPercent = (value, total) => {
  const safeTotal = Number(total || 0);
  const safeValue = Number(value || 0);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) return '%0';
  return `%${Math.round((safeValue / safeTotal) * 100)}`;
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
  const rfqStatusRows = useMemo(() => {
    const pending = Number(stats.rfqPending || 0);
    const passive = Number(stats.rfqPassive || 0);
    const openTotal = Number(stats.rfqActive || 0);
    const active = Math.max(openTotal - pending, 0);
    const total = pending + active + passive;

    return [
      { key: 'pending', label: 'Bekleyen', value: pending, percent: formatPercent(pending, total) },
      { key: 'active', label: 'Yayinda', value: active, percent: formatPercent(active, total) },
      { key: 'passive', label: 'Pasif', value: passive, percent: formatPercent(passive, total) }
    ];
  }, [stats.rfqActive, stats.rfqPassive, stats.rfqPending]);
  const roleSummaryRows = useMemo(() => {
    const total = Number(roleChartState.total || 0);
    const findValue = (key) => Number(roleChartState.segments.find((segment) => segment.key === key)?.value || 0);

    return [
      { key: 'buyer', label: 'buyer', value: findValue('buyer'), percent: formatPercent(findValue('buyer'), total) },
      { key: 'supplier', label: 'seller', value: findValue('supplier'), percent: formatPercent(findValue('supplier'), total) },
      { key: 'admin', label: 'admin', value: findValue('admin'), percent: formatPercent(findValue('admin'), total) }
    ];
  }, [roleChartState.segments, roleChartState.total]);

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

      <div className="admin-split-grid">
        <div className="admin-panel">
          <div className="admin-panel-title">Ozet Dagilim - RFQ durumlari</div>
          <div className="admin-panel-body">
            {loading ? (
              <div className="admin-empty">Yukleniyor...</div>
            ) : (
              <ul className="admin-list">
                {rfqStatusRows.map((item) => (
                  <li key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span className="admin-muted">
                        {item.value} · {item.percent}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="admin-muted">Bekleyen sayi, acik RFQ toplamindan ayrilarak cakismasiz hesaplanir.</div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-title">Ozet Dagilim - Kullanici rolleri</div>
          <div className="admin-panel-body">
            {roleChartState.loading ? (
              <div className="admin-empty">Yukleniyor...</div>
            ) : roleChartState.error ? (
              <div className="admin-warning">
                <div>{roleChartState.error}</div>
                <div className="admin-action-row" style={{ marginTop: 12 }}>
                  <button type="button" className="admin-btn" onClick={() => loadRoleDistribution(summary?.stats?.userTotal)}>
                    Tekrar dene
                  </button>
                </div>
              </div>
            ) : roleChartState.total <= 0 ? (
              <div className="admin-empty">Rol dagilimi icin kullanici verisi bulunamadi.</div>
            ) : (
              <ul className="admin-list">
                {roleSummaryRows.map((item) => (
                  <li key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span className="admin-muted">
                        {item.value} · {item.percent}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="admin-muted">Kaynak: /admin/users rol filtreleri ve toplam kullanici snapshot'i.</div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-title">Ozet Dagilim - Premium</div>
          <div className="admin-panel-body">
            <div className="admin-muted">Premium verisi mevcut degil.</div>
          </div>
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
