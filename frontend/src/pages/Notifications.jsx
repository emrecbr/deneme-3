import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { NotificationIcon } from '../components/ui/AppIcons';

function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setItems(response.data?.data || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bildirimler alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div>
      <div className="detail-head">
        <button type="button" className="secondary-btn" onClick={() => navigate(-1)}>
          Geri
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={async () => {
            try {
              await api.patch('/notifications/read-all');
              setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
            } catch (_error) {
              // ignore
            }
          }}
        >
          Tümünü okundu yap
        </button>
      </div>

      <section className="card">
        <h2>Bildirimler</h2>
        {loading ? <div className="refresh-text">Yükleniyor...</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {!loading && !error ? (
          items.length ? (
            <div className="notif-panel-list">
              {items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="notif-panel-item"
                  onClick={async () => {
                    if (!item.isRead) {
                      try {
                        await api.patch(`/notifications/${item._id}/read`);
                      } catch (_error) {
                        // ignore
                      }
                    }
                    const chatId = item?.data?.chatId;
                    const rfqId = item?.data?.rfqId || item?.data?.rfq;
                    if (chatId) {
                      navigate(`/messages/${chatId}`);
                    } else if (rfqId) {
                      navigate(`/rfq/${rfqId}`);
                    }
                  }}
                >
                  {item.message}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <NotificationIcon size={22} />
              </div>
              Bildirim yok.
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}

export default Notifications;
