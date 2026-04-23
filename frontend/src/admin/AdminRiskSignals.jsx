import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminRiskSignals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/moderation/risk-signals');
        if (!active) return;
        setData(response.data?.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Risk işaretleri alınamadı.');
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
      <div className="admin-panel-title">Risk İşaretleri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !data ? (
          <div className="admin-empty">Veri bulunamadı.</div>
        ) : (
          <>
            <div className="admin-panel-subtitle">Tekrarlayan başlıklar</div>
            {data.duplicateTitles?.length ? (
              <ul className="admin-list">
                {data.duplicateTitles.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item._id}</strong></div>
                    <span className="admin-muted">{item.count} kez</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Günlük yüksek RFQ</div>
            {data.highVolumeUsers?.length ? (
              <ul className="admin-list">
                {data.highVolumeUsers.map((item) => (
                  <li key={item.userId}>
                    <div><strong>{item.user?.email || item.userId}</strong></div>
                    <span className="admin-muted">{item.count} RFQ</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Eksik konumlu RFQ</div>
            {data.missingLocation?.length ? (
              <ul className="admin-list">
                {data.missingLocation.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item.title}</strong></div>
                    <span className="admin-muted">{item.city || 'Şehir yok'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
