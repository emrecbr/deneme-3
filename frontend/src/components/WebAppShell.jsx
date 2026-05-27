import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildSurfaceHref, WEB_HOME_PATH } from '../config/surfaces';

function WebAppShell({
  children,
  title = 'Talepet Keşif',
  description = 'Tarayıcıda ilanları inceleyin, kategorileri gezin ve talep akışını tek bir web ürün çerçevesinde yönetin.'
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, selectedCity, selectedDistrict } = useAuth();

  const locationLabel = selectedDistrict?.name && selectedCity?.name
    ? `${selectedCity.name} / ${selectedDistrict.name}`
    : selectedCity?.name || 'Tüm şehirler';

  const shortcuts = [
    { label: 'Kesfet', to: '/app', match: ['/app', '/'] },
    { label: 'Kategoriler', to: '/categories', match: ['/categories'] },
    { label: 'Profil', to: user ? '/profile' : '/login', match: ['/profile'] }
  ];

  return (
    <div className="web-app-shell">
      <header className="web-app-shell__header">
        <div className="web-app-shell__brand">
          <span className="web-app-shell__eyebrow">Browser Web App</span>
          <h1>Talepet</h1>
          <p>Tarayıcı içinde gerçek ürün deneyimi.</p>
        </div>

        <div className="web-app-shell__actions">
          <a className="web-app-shell__ghost-link" href={buildSurfaceHref('web', WEB_HOME_PATH)}>
            Website
          </a>
          <button
            type="button"
            className="web-app-shell__primary"
            onClick={() => navigate(user ? '/create' : '/login')}
          >
            {user ? 'Talep Oluştur' : 'Giriş Yap'}
          </button>
        </div>
      </header>

      <section className="web-app-shell__hero">
        <div>
          <p className="web-app-shell__hero-tag">Keşif, kategori ve teklif akışı</p>
          <h2>{title}</h2>
          <p className="web-app-shell__hero-copy">{description}</p>
        </div>

        <div className="web-app-shell__meta-grid">
          <div className="web-app-shell__meta-card">
            <span className="web-app-shell__meta-label">Konum bağlamı</span>
            <strong>{locationLabel}</strong>
            <small>Şehir ve ilçe seçimine göre listeleme akışı korunur.</small>
          </div>
          <div className="web-app-shell__meta-card">
            <span className="web-app-shell__meta-label">İlk ekran</span>
            <strong>RFQ listeleme</strong>
            <small>Mevcut backend ve filtreleme mantığı korunur.</small>
          </div>
          <div className="web-app-shell__meta-card">
            <span className="web-app-shell__meta-label">Hazır giriş noktası</span>
            <strong>Kategoriler ve profil</strong>
            <small>Web ürün omurgasının sonraki fazları için hazır.</small>
          </div>
        </div>
      </section>

      <nav className="web-app-shell__nav" aria-label="Web uygulama gezinmesi">
        {shortcuts.map((shortcut) => {
          const isActive = shortcut.match.some((match) =>
            location.pathname === match || location.pathname.startsWith(`${match}/`)
          );

          return (
            <NavLink
              key={shortcut.label}
              to={shortcut.to}
              className={`web-app-shell__nav-link ${isActive ? 'is-active' : ''}`}
            >
              {shortcut.label}
            </NavLink>
          );
        })}
      </nav>

      <main className="web-app-shell__content">{children}</main>
    </div>
  );
}

export default WebAppShell;
