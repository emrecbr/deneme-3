import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import ReusableBottomSheet from './ReusableBottomSheet';
import { FavoriteIcon, NotificationIcon } from './ui/AppIcons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { getSocket } from '../lib/socket';

function Layout({ children, showBottomNav = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, networkError, retryAuth } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifToast, setNotifToast] = useState(null);
  const isHome = location.pathname === '/';
  const HIDE_PREFIXES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/onboarding'
  ];
  const hideBottomNavByRoute = HIDE_PREFIXES.some((prefix) =>
    location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedKm, setSelectedKm] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const notifRef = useRef(null);
  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data?.data || []);
      setUnreadCount(Number(response.data?.unreadCount || 0));
    } catch (_error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
  }, [user?.id, user?._id]);

  useEffect(() => {
    if (isNotifOpen) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isNotifOpen]);


  useEffect(() => {
    if (!user) {
      return;
    }
    const socket = getSocket({ userId: user.id || user._id, city: user.city });
    if (!socket) {
      return;
    }
    const onNotification = () => {
      setUnreadCount((prev) => prev + 1);
      fetchNotifications();
    };
    const onNotificationRead = (payload) => {
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      if (payload?.notificationId && payload.notificationId !== 'all') {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === payload.notificationId ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
          )
        );
      } else if (payload?.notificationId === 'all') {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: new Date().toISOString() })));
      }
    };
    socket.on('notification:new', onNotification);
    socket.on('notification:read', onNotificationRead);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('notification:read', onNotificationRead);
    };
  }, [user]);

  useEffect(() => {
    const onHide = () => setHideBottomNav(true);
    const onShow = () => setHideBottomNav(false);
    window.addEventListener('bottomnav:hide', onHide);
    window.addEventListener('bottomnav:show', onShow);
    return () => {
      window.removeEventListener('bottomnav:hide', onHide);
      window.removeEventListener('bottomnav:show', onShow);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('rfq_header_filter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedCity(parsed?.selectedCity || '');
        setSelectedKm(Number(parsed?.selectedKm) || null);
      } catch (_error) {
        setSelectedCity('');
        setSelectedKm(null);
      }
    }

    const onFilterChange = (event) => {
      const city = event?.detail?.selectedCity || '';
      const km = Number(event?.detail?.selectedKm) || null;
      setSelectedCity(city);
      setSelectedKm(km);
    };

    window.addEventListener('rfq-filter-change', onFilterChange);
    return () => {
      window.removeEventListener('rfq-filter-change', onFilterChange);
    };
  }, []);

  const handleOpenNotifications = () => {
    setIsNotifOpen(true);
    fetchNotifications();
  };

  const handleCloseNotifications = () => {
    setIsNotifOpen(false);
  };

  const handleNotificationClick = async (item) => {
    if (!item) {
      return;
    }
    if (item._id && !item.isRead) {
      try {
        const response = await api.patch(`/notifications/${item._id}/read`);
        if (typeof response.data?.unreadCount === 'number') {
          setUnreadCount(response.data.unreadCount);
        } else {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        setNotifications((prev) =>
          prev.map((entry) =>
            entry._id === item._id ? { ...entry, isRead: true, readAt: new Date().toISOString() } : entry
          )
        );
      } catch (_error) {
        // ignore
      }
    }

    const data = item?.data || {};
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
    const chatId = item?.chatId || data?.chatId;
    handleCloseNotifications();
    if (rfqId) {
      navigate(`/rfq/${rfqId}`);
      return;
    }
    if (chatId) {
      navigate(`/messages/${chatId}`);
      return;
    }
    setNotifToast('Talep bulunamadı');
    window.setTimeout(() => setNotifToast(null), 2000);
  };

  const getNotifIcon = (item) => {
    const type = String(item?.type || item?.data?.type || '').toLowerCase();
    if (type.includes('favorite') || type.includes('favourite')) {
      return <FavoriteIcon size={16} active={true} />;
    }
    if (type.includes('approved') || type.includes('accepted')) return '✅';
    if (type.includes('rejected')) return '❌';
    if (type.includes('message')) return '💬';
    if (type.includes('offer')) return '💼';
    return <NotificationIcon size={16} />;
  };

  const getNotifTitle = (item) => item?.title || item?.message || 'Bildirim';
  const getNotifDesc = (item) =>
    item?.body || item?.description || item?.data?.preview || item?.data?.note || '';

  const formatNotifTime = (value) => {
    if (!value) {
      return '';
    }
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="app-layout">
      {networkError ? (
        <div className="network-banner">
          <span>{networkError}</span>
          <button type="button" className="secondary-btn" onClick={retryAuth}>
            Tekrar Dene
          </button>
        </div>
      ) : null}
      {!isOnline ? <div className="offline-banner">Cevrimdisisiniz</div> : null}
      <header className="app-header">
        <strong className="app-logo">{isHome ? 'Talep Et' : 'Talepet'}</strong>
        {isHome ? (
          <button
            type="button"
            className="header-filter-pill"
            onClick={() => window.dispatchEvent(new Event('open-rfq-filter-sheet'))}
          >
            {selectedCity ? (
              <>
                <span className="city">{selectedCity}</span>
                <span>•</span>
                <span className="km">{selectedKm} km</span>
              </>
            ) : (
              <span className="city">Sehir Sec</span>
            )}
          </button>
        ) : null}
        {user ? (
          <div className="header-actions" ref={notifRef}>
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => (isNotifOpen ? handleCloseNotifications() : handleOpenNotifications())}
              aria-label="Bildirimler"
            >
              <NotificationIcon size={24} unreadCount={unreadCount} />
            </button>
          </div>
        ) : null}
      </header>

      <main className="app-content">
        <div className="fade-page-enter-active">{children}</div>
      </main>

      <ReusableBottomSheet
        open={isNotifOpen}
        onClose={handleCloseNotifications}
        title="Bildirimler"
        contentClassName="notif-sheet"
        initialSnap="mid"
      >
        <div className="notif-list">
          {notifications.length ? (
            notifications.map((item) => (
              <button
                key={item._id || item.message}
                type="button"
                className={`notif-item ${item.isRead ? '' : 'unread'}`}
                onClick={() => handleNotificationClick(item)}
              >
                <span className="notif-icon">{getNotifIcon(item)}</span>
                <span className="notif-content">
                  <span className="notif-title">{getNotifTitle(item)}</span>
                  {getNotifDesc(item) ? <span className="notif-desc">{getNotifDesc(item)}</span> : null}
                </span>
                <span className="notif-meta">
                  <span className="notif-time">{formatNotifTime(item.createdAt)}</span>
                  {!item.isRead ? <span className="notif-dot" /> : null}
                </span>
              </button>
            ))
          ) : (
            <div className="notif-empty">Henüz bildirim yok</div>
          )}
        </div>
      </ReusableBottomSheet>

      {notifToast ? <div className="toast">{notifToast}</div> : null}

      {showBottomNav && !hideBottomNav && !hideBottomNavByRoute ? <BottomNav /> : null}
    </div>
  );
}

export default Layout;
