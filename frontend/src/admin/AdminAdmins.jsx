import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminAdmins() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [adminsRes, modsRes] = await Promise.all([
          api.get('/admin/users', { params: { role: 'admin' } }),
          api.get('/admin/users', { params: { role: 'moderator' } })
        ]);
        if (!active) return;
        setItems([...(adminsRes.data?.items || []), ...(modsRes.data?.items || [])]);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Admin kullanıcıları alınamadı.');
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
      <div className="admin-panel-title">Admin Kullanıcıları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kullanıcı bulunamadı.</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox">
              <div>Email</div>
              <div>Rol</div>
              <div>Durum</div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox">
                <div>{item.email}</div>
                <div>{item.role}</div>
                <div>{item.isDeleted ? 'Blocked' : item.isActive ? 'Active' : 'Passive'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
