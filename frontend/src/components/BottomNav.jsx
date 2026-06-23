import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChatUnreadCount } from '../context/ChatUnreadContext';
import { APP_HOME_PATH } from '../config/surfaces';

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function IconFollowedListings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12a2 2 0 0 1 2 2v15l-8-4-8 4V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6" />
      <path d="M9 13h4" />
    </svg>
  );
}

function IconMessages() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5Z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { globalUnreadCount } = useChatUnreadCount();
  const currentPath = location.pathname;
  const homePaths = ['/', APP_HOME_PATH];
  const followedListingsPaths = ['/listing-follows'];
  const messageBadgeLabel = globalUnreadCount > 99 ? '99+' : String(globalUnreadCount || '');

  const isActive = (paths, { exact = false } = {}) =>
    paths.some((path) => currentPath === path || (!exact && currentPath.startsWith(`${path}/`)));

  const openCreateFlow = () => {
    if (!user) {
      navigate('/create');
      return;
    }

    if (homePaths.includes(currentPath)) {
      window.dispatchEvent(new Event('open-rfq-create-sheet'));
      return;
    }

    if (currentPath !== '/create') {
      navigate('/create');
    }
  };

  return (
    <nav className="bottom-nav" aria-label="Ana gezinme">
      <button
        type="button"
        className={isActive(homePaths) ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (!homePaths.includes(currentPath)) {
            navigate(APP_HOME_PATH);
          }
        }}
        aria-label="Ana Sayfa"
        aria-current={isActive(homePaths) ? 'page' : undefined}
      >
        <span className="icon">
          <IconHome />
        </span>
      </button>

      <button
        type="button"
        className={isActive(followedListingsPaths, { exact: true }) ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (currentPath !== '/listing-follows') {
            navigate('/listing-follows');
          }
        }}
        aria-label="İlan Takiplerim"
        aria-current={isActive(followedListingsPaths, { exact: true }) ? 'page' : undefined}
      >
        <span className="icon">
          <IconFollowedListings />
        </span>
      </button>

      <div className="fab-slot">
        <button
          type="button"
          className={currentPath === '/create' ? 'fab-btn active' : 'fab-btn'}
          onClick={openCreateFlow}
          aria-label="Talep Oluştur"
          aria-current={currentPath === '/create' ? 'page' : undefined}
        >
          <span className="plus-icon">+</span>
        </button>
      </div>

      <button
        type="button"
        className={isActive(['/messages']) ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (currentPath !== '/messages') {
            navigate('/messages');
          }
        }}
        aria-label="Mesajlaşma"
        aria-current={isActive(['/messages']) ? 'page' : undefined}
      >
        <span className="icon">
          <IconMessages />
          {globalUnreadCount > 0 ? <span className="nav-unread-badge">{messageBadgeLabel}</span> : null}
        </span>
      </button>

      <button
        type="button"
        className={isActive(['/profile']) ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (currentPath !== '/profile') {
            navigate('/profile');
          }
        }}
        aria-label="Profil"
        aria-current={isActive(['/profile']) ? 'page' : undefined}
      >
        <span className="icon">
          <IconProfile />
        </span>
      </button>
    </nav>
  );
}

export default BottomNav;
