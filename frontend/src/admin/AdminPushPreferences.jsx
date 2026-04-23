import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminPushPreferences() {
  const [items, setItems] = useState([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      const response = await api.get(`/admin/notifications/push-preferences?${params.toString()}`);
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

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Bildirim Tercihleri</div>
      <div className="admin-panel-body">
        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Filtre</div>
          <div className="admin-form-grid">
            <label>
              <span>Kullanıcı ID</span>
              <input value={userId} onChange={(event) => setUserId(event.target.value)} />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="secondary-btn" onClick={load} disabled={loading}>
              {loading ? 'Yükleniyor...' : 'Filtrele'}
            </button>
          </div>
        </div>

        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Kayıtlar</div>
          {loading ? <div>Yükleniyor...</div> : null}
          {!loading && !items.length ? <div className="admin-empty">Kayıt bulunamadı.</div> : null}
          {items.map((item) => (
            <div key={item._id} className="admin-list-row">
              <div>
                <div className="admin-list-title">
                  {item.user?.name || item.user?.email || item.user?.phone || item.user?._id}
                </div>
                <div className="admin-muted">
                  Push: {item.pushEnabled ? 'Açık' : 'Kapalı'} · Sistem: {item.systemNotifications ? 'Açık' : 'Kapalı'} ·
                  Teklif: {item.offerNotifications ? 'Açık' : 'Kapalı'} · Mesaj: {item.messageNotifications ? 'Açık' : 'Kapalı'}
                </div>
              </div>
              <div className="admin-muted">{new Date(item.updatedAt).toLocaleString('tr-TR')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
