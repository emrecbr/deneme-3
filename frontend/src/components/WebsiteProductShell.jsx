import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  APP_HOME_PATH,
  WEBSITE_CATEGORIES_PATH,
  WEBSITE_CREATE_PATH,
  WEBSITE_DISCOVERY_PATH,
  WEBSITE_LOGIN_PATH,
  WEBSITE_PACKAGES_PATH,
  WEBSITE_PROFILE_HOME_PATH,
  WEBSITE_REGISTER_PATH,
  WEB_HOME_PATH,
  buildSurfaceHref
} from '../config/surfaces';

function WebsiteProductShell({
  children,
  title = 'Talepet web sitesi keşif deneyimi',
  description = 'Web sitesi içindeki ilk ürün ekranları daha geniş, web-first ve uygulama yüzeyinden ayrık bir layout içinde açılır.'
}) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { label: 'Kategoriler', to: WEBSITE_CATEGORIES_PATH, match: [WEBSITE_CATEGORIES_PATH] }
  ];

  const breadcrumbItems = (() => {
    if (location.pathname === WEBSITE_DISCOVERY_PATH) {
      return ['Website', 'Keşfet'];
    }
    if (location.pathname === WEBSITE_CATEGORIES_PATH) {
      return ['Website', 'Keşfet', 'Kategoriler'];
    }
    if (location.pathname === WEBSITE_CREATE_PATH) {
      return ['Website', 'Keşfet', 'Talep Oluştur'];
    }
    if (location.pathname.startsWith('/rfq/')) {
      return ['Website', 'Keşfet', 'Talep Detayı'];
    }
    return ['Website'];
  })();

  return (
    <div className="website-product-shell">
      <header className="website-product-shell__topbar">
        <Link to={WEB_HOME_PATH} className="landing-brand">
          Talepet
        </Link>

        <div className="website-product-shell__actions">
          {!user ? (
            <>
              <a href={buildSurfaceHref('web', WEBSITE_CATEGORIES_PATH)} className="landing-link-button">
                Kategoriler
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_PACKAGES_PATH)} className="landing-link-button">
                Paketler
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_LOGIN_PATH)} className="landing-link-button">
                Giriş Yap
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_REGISTER_PATH)} className="landing-primary-button">
                Kayıt Ol
              </a>
            </>
          ) : (
            <>
              <a href={buildSurfaceHref('web', WEBSITE_CATEGORIES_PATH)} className="landing-link-button">
                Kategoriler
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_PROFILE_HOME_PATH)} className="landing-link-button">
                Profilim
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_CREATE_PATH)} className="landing-primary-button">
                Talep Oluştur
              </a>
            </>
          )}
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayı Aç
          </a>
        </div>
      </header>

      <div className="website-product-shell__context-row">
        <div className="website-product-shell__breadcrumbs" aria-label="Sayfa bağlamı">
          {breadcrumbItems.map((item, index) => (
            <span key={`${item}-${index}`} className="website-product-shell__breadcrumb-item">
              {item}
            </span>
          ))}
        </div>
        <div className="website-product-shell__context-copy">
          {user
            ? 'Web sitesi ürün akışı içindesin. Keşfet, detay ve oluşturma ekranları aynı web deneyiminde bağlı çalışır.'
            : 'Keşfetmeye web sitesi içinde devam edebilir, kritik aksiyonlarda kontrollü şekilde giriş veya kayıt akışına geçebilirsin.'}
        </div>
      </div>

      <section className="website-product-shell__hero">
        <div className="website-product-shell__copy">
          <p className="landing-eyebrow">Web sitesi ürün omurgası</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <nav className="website-product-shell__nav" aria-label="Web sitesi ürün gezinmesi">
        {navItems.map((item) => {
          const isActive = item.match.some(
            (match) => location.pathname === match || location.pathname.startsWith(`${match}/`)
          );

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={`website-product-shell__nav-link ${isActive ? 'is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <main className="website-product-shell__content">{children}</main>
    </div>
  );
}

export default WebsiteProductShell;
