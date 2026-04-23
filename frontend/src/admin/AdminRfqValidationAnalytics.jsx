import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminRfqValidationAnalytics() {
  const [items, setItems] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const response = await api.get('/admin/rfq-flow/validation-analytics', { params });
      setItems(response.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Validasyon analitiği alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Validasyon Analitiği</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-filter-grid">
          <input className="admin-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="admin-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="admin-btn" onClick={load} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Filtrele'}
          </button>
        </div>
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Adım</div>
              <div>Alan</div>
              <div>Hata</div>
              <div>Adet</div>
            </div>
            {items.map((item, index) => (
              <div key={`${item.step}-${item.field}-${index}`} className="admin-table-row no-checkbox">
                <div>{item.step}</div>
                <div>{item.field}</div>
                <div>{item.error}</div>
                <div>{item.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
