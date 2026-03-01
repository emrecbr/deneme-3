import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

function BottomNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const currentPath = pathname;
  const showCreateFab = Boolean(user && pathname === '/');

  useEffect(() => {
    let lastPath = window.location.pathname;
    const watchPath = () => {
      const nextPath = window.location.pathname;
      if (nextPath !== lastPath) {
        lastPath = nextPath;
        setPathname(nextPath);
      }
    };

    const intervalId = window.setInterval(watchPath, 200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const isActive = (paths) => paths.some((path) => currentPath === path || currentPath.startsWith(`${path}/`));

  return (
    <nav className="bottom-nav">
      <div className="nav-items left">
        <button
          type="button"
          className={isActive(['/']) ? 'nav-item active' : 'nav-item'}
          onClick={() => {
            if (pathname !== '/') {
              navigate('/');
            }
          }}
        >
          <span className="icon">
            <IconHome />
          </span>
          <span className="label">Ana Sayfa</span>
        </button>
      </div>
      <div className="fab-slot">
        {showCreateFab ? (
          <button
            type="button"
            className="fab-btn"
            onClick={() => window.dispatchEvent(new Event('open-rfq-create-sheet'))}
            aria-label="Olustur"
          >
            <span className="plus-icon">+</span>
          </button>
        ) : null}
      </div>
      <div className="nav-items right">
        <button
          type="button"
          className={isActive(['/profile']) ? 'nav-item active' : 'nav-item'}
          onClick={() => {
            if (pathname !== '/profile') {
              navigate('/profile');
            }
          }}
        >
          <span className="icon">
            <IconProfile />
          </span>
          <span className="label">Profilim</span>
        </button>
      </div>
    </nav>
  );
}

export default BottomNav;
