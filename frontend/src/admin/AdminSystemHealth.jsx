import { useEffect, useState } from 'react';
import api from '../api/axios';

const STATUS_LABELS = {
  healthy: 'Sağlıklı',
  warning: 'Uyarı',
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
      return 'OTP süresi tanımlı değil. ENV: OTP_TTL_SECONDS veya OTP_TTL_MINUTES ayarlanmalı.';
    }
    return `OTP süresi: ${ttlValue}`;
  }
  if (check.key === 'sms') {
    const provider = String(check.detail || '');
    if (!provider || provider === 'unknown') {
      return 'SMS sağlayıcı tanımlı değil.';
    }
    if (provider.toLowerCase() === 'mock') {
      return 'SMS sağlayıcı: Mock (test modu).';
    }
    return `SMS sağlayıcı: ${provider}`;
  }
  if (check.key === 'database') {
    return check.status === 'healthy' ? 'MongoDB bağlantısı aktif.' : `MongoDB bağlantı sorunu (${check.detail || 'hazır değil'}).`;
  }
  if (check.key === 'audit') {
    return `Audit log kayıt sayısı: ${String(check.detail || '').replace('records=', '')}`;
  }
  return check.detail || '';
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
        setError(err?.response?.data?.message || 'Sistem sağlığı alınamadı.');
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
      <div className="admin-panel-title">Sistem Sağlığı</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !data ? (
          <div className="admin-empty">Veri bulunamadı.</div>
        ) : (
          <>
            <div className="admin-action-row">
              <span className={statusClass(data.status)}>
                {STATUS_LABELS[data.status] || data.status}
              </span>
              <span className="admin-muted">Sistem genel durumu</span>
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
