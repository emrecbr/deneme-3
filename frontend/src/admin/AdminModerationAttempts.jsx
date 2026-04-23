import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/adminApi';

export default function AdminModerationAttempts() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    contentType: '',
    search: ''
  });

  const load = async () => {
    try {
      setError('');
      const response = await api.get('/admin/moderation/attempts', { params: filters });
      setItems(response.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Moderasyon denemeleri alınamadı.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Engellenen İçerik Denemeleri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            <span>Durum</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="blocked">Engellendi</option>
              <option value="under_review">İncelemede</option>
              <option value="approved_override">Onaylandı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </label>
          <label>
            <span>İçerik Türü</span>
            <select
              value={filters.contentType}
              onChange={(event) => setFilters((prev) => ({ ...prev, contentType: event.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="rfq">RFQ</option>
              <option value="offer">Teklif</option>
              <option value="message">Mesaj</option>
              <option value="profile">Profil</option>
            </select>
          </label>
          <label>
            <span>Arama</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Başlık / kelime ara"
            />
          </label>
        </div>

        {items.length ? (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{item.attemptedTitle || 'Başlıksız içerik'}</strong>
                  <span className="admin-muted">
                    {item.contentType} · {item.status} · {item.decision || '—'} · risk {item.riskScore || 0} · {item.user?.email || 'Kullanıcı yok'}
                  </span>
                  {item.matchedTerms?.length ? (
                    <span className="admin-muted">Eşleşen: {item.matchedTerms.join(', ')}</span>
                  ) : null}
                </div>
                <div className="admin-actions">
                  <Link to={`/admin/moderation/attempts/${item._id}`} className="link-btn">
                    Detay
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        )}
      </div>
    </div>
  );
}
