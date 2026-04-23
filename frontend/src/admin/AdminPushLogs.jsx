import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

export default function AdminPushLogs() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (query) params.set('q', query);
      const response = await api.get(`/admin/notifications/push-logs?${params.toString()}`);
      setItems(response.data?.items || []);
    } catch (_error) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => items, [items]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Push Gönderim Logları</div>
      <div className="admin-panel-body">
        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Filtreler</div>
          <div className="admin-form-grid">
            <label>
              <span>Durum</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Hepsi</option>
                <option value="sent">Gönderildi</option>
                <option value="failed">Başarısız</option>
                <option value="queued">Kuyrukta</option>
              </select>
            </label>
            <label>
              <span>Tip</span>
              <input value={type} onChange={(event) => setType(event.target.value)} placeholder="rfq_created vb." />
            </label>
            <label>
              <span>Arama</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık/mesaj" />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="secondary-btn" onClick={load} disabled={loading}>
              {loading ? 'Yükleniyor...' : 'Filtrele'}
            </button>
          </div>
        </div>

        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Son Gönderimler</div>
          {loading ? <div>Yükleniyor...</div> : null}
          {!loading && !filtered.length ? <div className="admin-empty">Kayıt bulunamadı.</div> : null}
          {filtered.map((item) => (
            <div key={item._id} className="admin-list-row">
              <div>
                <div className="admin-list-title">{item.title || item.type}</div>
                <div className="admin-muted">{item.body}</div>
                <div className="admin-muted">
                  {item.user?.name || item.user?.email || item.user?.phone || 'Bilinmeyen kullanıcı'} ·{' '}
                  {new Date(item.createdAt).toLocaleString('tr-TR')}
                </div>
              </div>
              <span className={`admin-status-pill ${item.status === 'failed' ? 'is-error' : 'is-healthy'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
