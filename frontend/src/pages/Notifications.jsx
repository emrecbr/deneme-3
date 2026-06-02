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

  const resolveNotificationTarget = (item) => {
    const data = item?.data || {};
    if (item?.targetUrl || data?.targetUrl) {
      return item.targetUrl || data.targetUrl;
    }
    const type = String(item?.type || data?.type || '').toLowerCase();
    const chatId = item?.chatId || data?.chatId;
    if (type === 'message' && chatId) {
      return `/messages/${chatId}`;
    }
    const rfqId =
      item?.requestId ||
      item?.rfqId ||
      item?.demandId ||
      item?.targetId ||
      item?.entityId ||
      data?.requestId ||
      data?.rfqId ||
      data?.demandId ||
      data?.targetId ||
      data?.entityId ||
      data?.rfq;
    if (rfqId) {
      return `/rfq/${rfqId}`;
    }
    if (chatId) {
      return `/messages/${chatId}`;
    }
    if (type === 'new_matching_rfq') {
      return '/listing-follows';
    }
    if (type === 'moderation_result' || type === 'listing_expiring' || type === 'listing_expired') {
      return '/profile/requests';
    }
    if (type === 'payment_success' || type === 'premium_activated' || type === 'featured_activated') {
      return '/profile';
    }
    return '';
  };

  const formatNotificationDate = (value) => {
    if (!value) {
      return '';
    }
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationTitle = (item) => item?.title || item?.message || 'Bildirim';
  const getNotificationBody = (item) =>
    item?.body || item?.description || item?.data?.preview || item?.data?.note || '';

  const markNotificationRead = async (item) => {
    if (!item?._id) {
      return;
    }
    setItems((prev) => prev.filter((entry) => entry._id !== item._id));
    try {
      await api.patch(`/notifications/${item._id}/read`);
    } catch (_error) {
      fetchNotifications();
    }
  };

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
              setItems([]);
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
                    const target = resolveNotificationTarget(item);
                    await markNotificationRead(item);
                    if (target) {
                      navigate(target);
                    }
                  }}
                >
                  <span className="notif-panel-title">{getNotificationTitle(item)}</span>
                  {getNotificationBody(item) ? (
                    <span className="notif-panel-desc">{getNotificationBody(item)}</span>
                  ) : null}
                  <span className="notif-panel-date">{formatNotificationDate(item.createdAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <NotificationIcon size={22} />
              </div>
              <p>Yeni bildiriminiz yok.</p>
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
