import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { websiteProfileNavItems } from '../content/profileNavigation';
import {
  APP_HOME_PATH,
  WEB_HOME_PATH,
  WEBSITE_LOGIN_PATH,
  buildSurfaceHref
} from '../config/surfaces';

function WebsiteProfileShell({
  children,
  title = 'Profil alanın',
  description = 'Web sitesi içinden hesap özetini gör, modüller arasında geçiş yap ve uygulama ile aynı backend altyapısına bağlı kal.'
}) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.email || 'Talepet kullanıcısı';
  const email = user?.email || 'E-posta bilgisi bulunamadı';
  const premiumLabel = user?.isPremium ? 'Premium aktif' : 'Standart hesap';
  const activeItem =
    websiteProfileNavItems.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    ) || null;

  const handleLogout = () => {
    logout({ redirect: true });
  };

  return (
    <div className="website-profile-shell">
      <header className="website-profile-shell__topbar">
        <a href={buildSurfaceHref('web', WEB_HOME_PATH)} className="landing-brand">
          Talepet
        </a>

        <div className="website-profile-shell__topbar-actions">
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayı Aç
          </a>
        </div>
      </header>

      <section className="website-profile-shell__hero">
        <div className="website-profile-shell__hero-copy">
          <div className="website-profile-shell__breadcrumb">
            <Link to={WEB_HOME_PATH}>Talepet</Link>
            <span>/</span>
            <span>Profil</span>
            {activeItem ? (
              <>
                <span>/</span>
                <strong>{activeItem.label}</strong>
              </>
            ) : null}
          </div>
          <p className="landing-eyebrow">Web sitesi profil alanı</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="website-profile-shell__hero-card">
          <div className="website-profile-shell__hero-avatar" aria-hidden="true">
            {(displayName || '?').trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="website-profile-shell__hero-meta">
            <strong>{displayName}</strong>
            <span>{email}</span>
            <span>{premiumLabel}</span>
          </div>
        </div>
      </section>

      <div className="website-profile-shell__layout">
        <aside className="website-profile-shell__sidebar">
          <div className="website-profile-shell__sidebar-card">
            <h2>Profil Modülleri</h2>
            <p>
              Profil, web sitesi bağlamında daha geniş bir bilgi mimarisiyle açılır; uygulama hostundaki
              mobil akış değişmeden kalır.
            </p>
          </div>

          <nav className="website-profile-shell__nav" aria-label="Website profil gezinmesi">
            {websiteProfileNavItems.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`website-profile-shell__nav-link ${active ? 'is-active' : ''}`}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="website-profile-shell__sidebar-card website-profile-shell__support-card">
            <h2>Yardim ve Guven</h2>
            <p>
              Destek, gizlilik ve satis sozlesmesi gibi kritik iceriklere profil alanindan cikmadan
              ulas.
            </p>
            <div className="website-profile-shell__support-links">
              <a href={buildSurfaceHref('web', '/iletisim')}>Destek</a>
              <a href={buildSurfaceHref('web', '/gizlilik-sozlesmesi')}>Gizlilik</a>
              <a href={buildSurfaceHref('web', '/mesafeli-satis-sozlesmesi')}>Mesafeli Satis</a>
            </div>
          </div>

          <div className="website-profile-shell__sidebar-card website-profile-shell__session-card">
            <h2>Oturum</h2>
            <p>Web sitesi profil alanından çıkış yapıp giriş ekranına kontrollü şekilde dönebilirsin.</p>
            <button
              type="button"
              className="website-profile-shell__logout-button"
              onClick={handleLogout}
            >
              Çıkış Yap
            </button>
            <a
              href={buildSurfaceHref('web', WEBSITE_LOGIN_PATH)}
              className="website-profile-shell__session-link"
            >
              Giriş ekranını aç
            </a>
          </div>
        </aside>

        <main className="website-profile-shell__content">{children}</main>
      </div>
    </div>
  );
}

export default WebsiteProfileShell;
