import { useEffect, useState } from 'react';
import api from '../api/adminApi';

const STATUS_LABELS = {
  healthy: 'Saglikli',
  warning: 'Uyari',
  error: 'Hata'
};

const statusClass = (status) => {
  if (status === 'healthy') return 'admin-status-pill is-healthy';
  if (status === 'warning') return 'admin-status-pill is-warning';
  if (status === 'error') return 'admin-status-pill is-error';
  return 'admin-status-pill';
};

const formatDetail = (check) => {
  if (!check) return '';
  if (check.key === 'otp') {
    const detail = String(check.detail || '');
    const ttlMatch = detail.match(/ttl=([^\s]+)/);
    const ttlValue = ttlMatch ? ttlMatch[1] : '';
    if (!ttlValue || ttlValue === 'unset' || ttlValue === '0') {
      return 'OTP suresi tanimli degil. ENV tarafinda OTP_TTL_SECONDS veya OTP_TTL_MINUTES ayarlanmalidir.';
    }
    return `OTP suresi tanimli: ${ttlValue}`;
  }
  if (check.key === 'sms') {
    const provider = String(check.detail || '');
    if (!provider || provider === 'unknown') {
      return 'SMS saglayicisi tanimli degil.';
    }
    if (provider.toLowerCase() === 'mock') {
      return 'SMS saglayicisi mock modda calisiyor. Bu ortam test veya hazirlik modu olabilir.';
    }
    return `SMS saglayicisi aktif: ${provider}`;
  }
  if (check.key === 'database') {
    return check.status === 'healthy'
      ? 'MongoDB baglantisi aktif.'
      : `MongoDB baglantisinda sorun var (${check.detail || 'hazir degil'}).`;
  }
  if (check.key === 'audit') {
    return `Audit log kayit sayisi: ${String(check.detail || '').replace('records=', '')}`;
  }
  if (check.status === 'warning') {
    return check.detail || 'Bu kontrol dikkat gerektiriyor.';
  }
  if (check.status === 'error') {
    return check.detail || 'Bu kontrol hata durumuna dusmus.';
  }
  return check.detail || 'Kontrol basarili.';
};

export default function AdminSystemHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/system/health');
        if (!active) return;
        setData(response.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Sistem sagligi alinamadi.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Sistem Sagligi</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yukleniyor…</div>
        ) : !data ? (
          <div className="admin-empty">Veri bulunamadi.</div>
        ) : (
          <>
            <div className="admin-action-row">
              <span className={statusClass(data.status)}>
                {STATUS_LABELS[data.status] || data.status}
              </span>
              <span className="admin-muted">
                {data.status === 'healthy'
                  ? 'Tum temel kontroller su anda stabil gorunuyor.'
                  : data.status === 'warning'
                    ? 'Bazi kontroller dikkat istiyor; detay kartlarini inceleyin.'
                    : 'Bir veya daha fazla kritik kontrol hata veriyor.'}
              </span>
            </div>
            <div className="admin-card-grid">
              {(data.checks || []).map((check) => (
                <div key={check.key} className="admin-card">
                  <div className="admin-card-label">{check.label}</div>
                  <div className="admin-card-value">
                    {STATUS_LABELS[check.status] || check.status}
                  </div>
                  <div className="admin-muted">{formatDetail(check)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
