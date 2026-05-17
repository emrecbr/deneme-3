import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { NotificationIcon } from '../components/ui/AppIcons';

function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/profile');
  };

  const fetchNotifications = useCallback(async (options = {}) => {
    const { isActive = () => true } = options;
    try {
      if (!isActive()) {
        return;
      }
      setLoading(true);
      const response = await api.get('/notifications');
      if (!isActive()) {
        return;
      }
      setItems(response.data?.data || []);
      setError('');
    } catch (requestError) {
      if (!isActive()) {
        return;
      }
      setError(requestError.response?.data?.message || 'Bildirimler alinamadi.');
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchNotifications({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [fetchNotifications]);

  return (
    <div>
      <div className="detail-head">
        <button type="button" className="secondary-btn" onClick={handleBack}>
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
        {error ? (
          <div className="card ux-error-state">
            <p>{error}</p>
            <button type="button" className="secondary-btn" onClick={() => fetchNotifications()}>
              Tekrar Dene
            </button>
          </div>
        ) : null}
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
              <p>Bildirim yok.</p>
              <button type="button" className="secondary-btn" onClick={() => navigate('/app')}>
                Ana sayfaya don
              </button>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}

export default Notifications;
