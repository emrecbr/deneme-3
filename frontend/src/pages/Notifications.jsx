import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { NotificationIcon } from '../components/ui/AppIcons';
import {
  getNotificationId,
  markAllNotificationsRead,
  markNotificationRead as markNotificationReadRequest,
  normalizeNotifications,
  resolveNotificationTarget
} from '../utils/notificationActions';

function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readingIds, setReadingIds] = useState(() => new Set());

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
      setItems(normalizeNotifications(response.data?.data || []));
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
    const id = getNotificationId(item);
    if (!id) {
      setError('Bildirim kimliği bulunamadı.');
      return false;
    }
    if (readingIds.has(id)) {
      return false;
    }
    setReadingIds((prev) => new Set(prev).add(id));
    setItems((prev) => prev.filter((entry) => getNotificationId(entry) !== id));
    try {
      await markNotificationReadRequest(api, item);
      setError('');
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bildirim okundu yapılamadı.');
      fetchNotifications();
      return false;
    } finally {
      setReadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleNotificationClick = async (item) => {
    const target = resolveNotificationTarget(item);
    await markNotificationRead(item);
    if (target) {
      navigate(target);
    }
  };

  const handleReadButtonClick = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    await markNotificationRead(item);
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead(api);
      setItems([]);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bildirimler okundu yapılamadı.');
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
          onClick={handleReadAll}
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
                <div
                  key={getNotificationId(item)}
                  role="button"
                  tabIndex={0}
                  className="notif-panel-item"
                  onClick={() => handleNotificationClick(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                >
                  <span className="notif-panel-title">{getNotificationTitle(item)}</span>
                  {getNotificationBody(item) ? (
                    <span className="notif-panel-desc">{getNotificationBody(item)}</span>
                  ) : null}
                  <span className="notif-panel-date">{formatNotificationDate(item.createdAt)}</span>
                  <button
                    type="button"
                    className="notif-mark-read-btn notif-panel-mark-read-btn"
                    disabled={readingIds.has(getNotificationId(item))}
                    onClick={(event) => handleReadButtonClick(event, item)}
                  >
                    {readingIds.has(getNotificationId(item)) ? 'İşleniyor' : 'Okundu Yap'}
                  </button>
                </div>
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
