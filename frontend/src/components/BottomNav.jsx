import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_HOME_PATH } from '../config/surfaces';

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.8-3.5 5-5.3 8-5.3S18.2 17.5 20 21" />
    </svg>
  );
}

function IconRequests() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8" />
      <path d="M9 2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a2 2 0 0 1 2-2Z" />
      <path d="M8 11h8" />
      <path d="M8 16h5" />
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

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;
  const homePaths = ['/', APP_HOME_PATH];

  const isActive = (paths, { exact = false } = {}) =>
    paths.some((path) => currentPath === path || (!exact && currentPath.startsWith(`${path}/`)));
  const isRequestsActive = isActive(['/profile/requests']);
  const isProfileActive = isActive(['/profile']) && !isRequestsActive;

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
        className={isRequestsActive ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (currentPath !== '/profile/requests') {
            navigate('/profile/requests');
          }
        }}
        aria-label="Taleplerim"
        aria-current={isRequestsActive ? 'page' : undefined}
      >
        <span className="icon">
          <IconRequests />
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
        aria-label="Mesajlar"
        aria-current={isActive(['/messages']) ? 'page' : undefined}
      >
        <span className="icon">
          <IconMessages />
        </span>
      </button>

      <button
        type="button"
        className={isProfileActive ? 'nav-item active' : 'nav-item'}
        onClick={() => {
          if (currentPath !== '/profile') {
            navigate('/profile');
          }
        }}
        aria-label="Profilim"
        aria-current={isProfileActive ? 'page' : undefined}
      >
        <span className="icon">
          <IconProfile />
        </span>
      </button>
    </nav>
  );
}

export default BottomNav;
