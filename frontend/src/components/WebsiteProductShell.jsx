import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  APP_HOME_PATH,
  WEBSITE_CATEGORIES_PATH,
  WEBSITE_CREATE_PATH,
  WEBSITE_DISCOVERY_PATH,
  WEBSITE_LOGIN_PATH,
  WEBSITE_PACKAGES_PATH,
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
  const { user, selectedCity, selectedDistrict } = useAuth();

  const locationLabel =
    selectedDistrict?.name && selectedCity?.name
      ? `${selectedCity.name} / ${selectedDistrict.name}`
      : selectedCity?.name || 'Tum sehirler';

  const navItems = [
    { label: 'Website', to: WEB_HOME_PATH, match: [WEB_HOME_PATH] },
    { label: 'Kesfet', to: WEBSITE_DISCOVERY_PATH, match: [WEBSITE_DISCOVERY_PATH] },
    { label: 'Kategoriler', to: WEBSITE_CATEGORIES_PATH, match: [WEBSITE_CATEGORIES_PATH] },
    { label: 'Talep Olustur', to: WEBSITE_CREATE_PATH, match: [WEBSITE_CREATE_PATH] }
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
              <Link to={WEBSITE_PACKAGES_PATH} className="landing-link-button">
                Paketler
              </Link>
              <Link to={WEBSITE_LOGIN_PATH} className="landing-link-button">
                Giris Yap
              </Link>
              <Link to={WEBSITE_REGISTER_PATH} className="landing-primary-button">
                Kayit Ol
              </Link>
            </>
          ) : (
            <Link to={WEBSITE_CREATE_PATH} className="landing-primary-button">
              Talep Olustur
            </Link>
          )}
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayi Ac
          </a>
        </div>
      </header>

      <section className="website-product-shell__hero">
        <div className="website-product-shell__copy">
          <p className="landing-eyebrow">Website urun omurgasi</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="website-product-shell__meta">
          <div className="website-product-shell__meta-card">
            <span>Aktif baglam</span>
            <strong>{locationLabel}</strong>
          </div>
          <div className="website-product-shell__meta-card">
            <span>Surface</span>
            <strong>Website / web-first</strong>
          </div>
          <div className="website-product-shell__meta-card">
            <span>Hedef</span>
            <strong>Kesiften urune kontrollu gecis</strong>
          </div>
        </div>
      </section>

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
