import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminModerationRiskUsers() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/admin/moderation/risk-users');
        setItems(response.data?.items || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Riskli kullanıcılar alınamadı.');
      }
    };
    load();
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Riskli Kullanıcılar</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {items.length ? (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item.userId || item._id}>
                <div>
                  <strong>{item.user?.name || 'Bilinmeyen'}</strong>
                  <span className="admin-muted">{item.user?.email || 'E-posta yok'}</span>
                  <span className="admin-muted">
                    Toplam: {item.total} · Block: {item.blocked} · Review: {item.review}
                  </span>
                  {item.topTerms?.length ? (
                    <span className="admin-muted">Eşleşen: {item.topTerms.join(', ')}</span>
                  ) : null}
                </div>
                <div className="admin-actions">
                  <span className="admin-muted">Son deneme: {new Date(item.lastAttempt).toLocaleString('tr-TR')}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">Riskli kullanıcı yok.</div>
        )}
      </div>
    </div>
  );
}
