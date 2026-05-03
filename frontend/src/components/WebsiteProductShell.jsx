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
  title = 'Talepet website kesif deneyimi',
  description = 'Website icindeki ilk urun ekranlari daha genis, web-first ve app yuzeyinden ayrik bir layout icinde acilir.'
}) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { label: 'Kategoriler', to: WEBSITE_CATEGORIES_PATH, match: [WEBSITE_CATEGORIES_PATH] }
  ];

  const breadcrumbItems = (() => {
    if (location.pathname === WEBSITE_DISCOVERY_PATH) {
      return ['Website', 'Kesfet'];
    }
    if (location.pathname === WEBSITE_CATEGORIES_PATH) {
      return ['Website', 'Kesfet', 'Kategoriler'];
    }
    if (location.pathname === WEBSITE_CREATE_PATH) {
      return ['Website', 'Kesfet', 'Talep Olustur'];
    }
    if (location.pathname.startsWith('/rfq/')) {
      return ['Website', 'Kesfet', 'Talep Detayi'];
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
                Giris Yap
              </a>
              <a href={buildSurfaceHref('web', WEBSITE_REGISTER_PATH)} className="landing-primary-button">
                Kayit Ol
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
                Talep Olustur
              </a>
            </>
          )}
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayi Ac
          </a>
        </div>
      </header>

      <div className="website-product-shell__context-row">
        <div className="website-product-shell__breadcrumbs" aria-label="Sayfa baglami">
          {breadcrumbItems.map((item, index) => (
            <span key={`${item}-${index}`} className="website-product-shell__breadcrumb-item">
              {item}
            </span>
          ))}
        </div>
        <div className="website-product-shell__context-copy">
          {user
            ? 'Website urun akisi icindesin. Kesfet, detay ve olusturma ekranlari ayni web deneyiminde bagli calisir.'
            : 'Kesfetmeye website icinde devam edebilir, kritik aksiyonlarda kontrollu sekilde giris veya kayit akisina gecebilirsin.'}
        </div>
      </div>

      <section className="website-product-shell__hero">
        <div className="website-product-shell__copy">
          <p className="landing-eyebrow">Website urun omurgasi</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <nav className="website-product-shell__nav" aria-label="Website urun gezinmesi">
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
