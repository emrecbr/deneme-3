import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/adminApi';

export default function AdminModerationQueueAdvanced() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { status };
      if (flagged) params.flagged = 'true';
      const response = await api.get('/admin/moderation/queue-advanced', { params });
      setItems(response.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Moderasyon kuyruğu alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, flagged]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Gelişmiş Moderasyon Kuyruğu</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-filter-grid">
          <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Onaylanan</option>
            <option value="rejected">Reddedilen</option>
            <option value="flagged">Flagged</option>
          </select>
          <label className="admin-flag-row">
            <span>Flagged only</span>
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
          </label>
        </div>
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Başlık</div>
              <div>Kullanıcı</div>
              <div>Şehir</div>
              <div>Durum</div>
              <div></div>
            </div>
            {items.map((rfq) => (
              <div key={rfq._id} className="admin-table-row no-checkbox">
                <div>{rfq.title}</div>
                <div>{rfq.buyer?.email || '—'}</div>
                <div>{rfq.city?.name || rfq.locationData?.city || '—'}</div>
                <div>{rfq.moderationStatus || 'pending'}</div>
                <div>
                  <Link to={`/admin/rfq/${rfq._id}`} className="admin-link">Detay</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
