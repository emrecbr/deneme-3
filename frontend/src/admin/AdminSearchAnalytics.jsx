import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminSearchAnalytics() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hasResults, setHasResults] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (hasResults) params.hasResults = hasResults;
      if (categoryId) params.categoryId = categoryId;
      const response = await api.get('/admin/search/analytics', { params });
      setData(response.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Arama analitiği alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Arama Analitiği</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-filter-grid">
          <input className="admin-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="admin-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="admin-input" value={hasResults} onChange={(e) => setHasResults(e.target.value)}>
            <option value="">Sonuç durumu</option>
            <option value="true">Sonuç var</option>
            <option value="false">Sonuç yok</option>
          </select>
          <select className="admin-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Kategori</option>
            {(data?.categories || []).map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <button type="button" className="admin-btn" onClick={load} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Filtrele'}
          </button>
        </div>

        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !data ? (
          <div className="admin-empty">Veri bulunamadı.</div>
        ) : (
          <>
            <div className="admin-panel-subtitle">En çok arananlar</div>
            {data.topTerms?.length ? (
              <ul className="admin-list">
                {data.topTerms.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item.term || item._id}</strong></div>
                    <span className="admin-muted">{item.count} arama</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Sonuç vermeyen aramalar</div>
            {data.zeroResults?.length ? (
              <ul className="admin-list">
                {data.zeroResults.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item.term || item._id}</strong></div>
                    <span className="admin-muted">{item.count} kez</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Popüler öneriler</div>
            {data.suggestionStats?.length ? (
              <ul className="admin-list">
                {data.suggestionStats.map((item) => (
                  <li key={item.suggestionId}>
                    <div><strong>{item.term}</strong></div>
                    <span className="admin-muted">{item.count} tıklama</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Kayıt yok.</div>
            )}

            <div className="admin-panel-subtitle">Son aramalar</div>
            {data.recent?.length ? (
              <ul className="admin-list">
                {data.recent.map((item) => (
                  <li key={item._id}>
                    <div><strong>{item.term}</strong></div>
                    <span className="admin-muted">{new Date(item.createdAt).toLocaleString('tr-TR')}</span>
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
