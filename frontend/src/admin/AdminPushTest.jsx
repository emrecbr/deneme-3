import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminPushTest() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [title, setTitle] = useState('Test bildirimi');
  const [body, setBody] = useState('Bu bir test bildirimidir.');
  const [deepLink, setDeepLink] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/admin/users?limit=20');
        setUsers(response.data?.items || []);
      } catch (_error) {
        setUsers([]);
      }
    };
    loadUsers();
  }, []);

  const handleSend = async () => {
    try {
      setLoading(true);
      setResult('');
      const payload = {
        userId: userId || undefined,
        externalId: externalId || undefined,
        title,
        body,
        deepLink: deepLink || undefined
      };
      const response = await api.post('/admin/notifications/push-test', payload);
      if (response.data?.success) {
        setResult('Bildirim gönderildi.');
      } else {
        setResult(response.data?.message || 'Gönderim başarısız.');
      }
    } catch (err) {
      setResult(err?.response?.data?.message || 'Gönderim başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Push Bildirim Testi</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu ekran üzerinden tek bir kullanıcıya test bildirimi gönderebilirsiniz.
        </div>
        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Hedef Kullanıcı</div>
          <div className="admin-form-grid">
            <label>
              <span>Kullanıcı Seç</span>
              <select value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Kullanıcı seç</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name || user.email || user.phone || user._id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>External ID (opsiyonel)</span>
              <input
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                placeholder="Harici external_id"
              />
            </label>
          </div>
        </div>

        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Mesaj İçeriği</div>
          <div className="admin-form-grid">
            <label>
              <span>Başlık</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>Mesaj</span>
              <textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <label>
              <span>Deep Link (opsiyonel)</span>
              <input value={deepLink} onChange={(event) => setDeepLink(event.target.value)} />
            </label>
          </div>
        </div>

        {result ? <div className="admin-info">{result}</div> : null}

        <div className="admin-form-actions">
          <button type="button" className="primary-btn" onClick={handleSend} disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
