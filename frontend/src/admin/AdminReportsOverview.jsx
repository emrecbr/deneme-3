import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminReportsOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/reports/overview');
        if (!active) return;
        setData(response.data?.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Raporlar alınamadı.');
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
      <div className="admin-panel-title">Rapor Özeti</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !data ? (
          <div className="admin-empty">Veri bulunamadı.</div>
        ) : (
          <>
            <div className="admin-panel-subtitle">Şehir bazlı RFQ</div>
            {data.cityCounts?.length ? (
              <ul className="admin-list">
                {data.cityCounts.map((item) => (
                  <li key={item.id || item.name}>
                    <div><strong>{item.name}</strong></div>
                    <span className="admin-muted">{item.count} RFQ</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Kategori bazlı RFQ</div>
            {data.categoryCounts?.length ? (
              <ul className="admin-list">
                {data.categoryCounts.map((item) => (
                  <li key={item.id || item.name}>
                    <div><strong>{item.name}</strong></div>
                    <span className="admin-muted">{item.count} RFQ</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Günlük kullanıcı kayıtları</div>
            {data.usersDaily?.length ? (
              <ul className="admin-list">
                {data.usersDaily.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item._id}</strong></div>
                    <span className="admin-muted">{item.count} kullanıcı</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Sonuçsuz aramalar</div>
            {data.zeroSearches?.length ? (
              <ul className="admin-list">
                {data.zeroSearches.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item.term || item._id}</strong></div>
                    <span className="admin-muted">{item.count} kez</span>
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
