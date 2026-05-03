import { useLocation } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import { APP_HOME_PATH, WEBSITE_LOGIN_PATH, WEBSITE_REGISTER_PATH, buildSurfaceHref } from '../config/surfaces';

function WebsiteAuthShell({
  eyebrow = 'Talepet hesabi',
  title = 'Talepet hesabina website icinden devam et',
  description = 'Website baglaminda giris yapabilir, kayit olabilir ve uygulamaya gecis zamanini kontrollu sekilde belirleyebilirsin.',
  children
}) {
  const location = useLocation();
  const registerRoute = location.pathname === WEBSITE_REGISTER_PATH;
  const secondaryCta = registerRoute
    ? { to: WEBSITE_LOGIN_PATH, label: 'Giris Yap' }
    : { to: WEBSITE_REGISTER_PATH, label: 'Kayit Ol' };

  return (
    <div className="website-auth-shell">
      <header className="website-auth-topbar">
          <a href={buildSurfaceHref('web', '/')} className="landing-brand">
            Talepet
          </a>

        <div className="landing-topbar-actions">
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayi Ac
          </a>
        </div>
      </header>

      <section className="website-auth-hero">
        <div className="website-auth-copy">
          <p className="landing-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>

          <div className="website-auth-badges">
            <span className="website-auth-badge">Sehir ve ilce odakli</span>
            <span className="website-auth-badge">Moderasyon destekli</span>
            <span className="website-auth-badge">Teklif akisi hazir</span>
          </div>

          <div className="website-auth-points">
            <div className="website-auth-point">
              <strong>Website onboarding</strong>
              <span>Kayit ve giris adimlari website dilini korur, gereksiz app sicrama olmaz.</span>
            </div>
            <div className="website-auth-point">
              <strong>Ayni auth altyapisi</strong>
              <span>E-posta, telefon, OTP ve social auth mevcut backend akislariyla calisir.</span>
            </div>
            <div className="website-auth-point">
              <strong>Kontrollu gecis</strong>
              <span>Urun kullanimi gerektiginde app tarafina gecis bilincli ve host-aware yapilir.</span>
            </div>
          </div>

          <div className="website-auth-side-card">
            <div>
              <p className="website-auth-side-eyebrow">Talepet ile neler yaparsin?</p>
              <h2>{registerRoute ? 'Dakikalar icinde hesap ac, teklif almaya hazir ol.' : 'Talep, teklif ve profil akisina ayni hesaptan devam et.'}</h2>
            </div>

            <ul className="website-auth-side-list">
              <li>Kategori bazli talep olustur ve dogru kisilere ulas.</li>
              <li>Sehir ve ilceye gore daha isabetli eslesmeler gor.</li>
              <li>Moderasyon ve premium gorunurluk katmanlariyla daha guvenli ilerle.</li>
            </ul>

            <div className="website-auth-side-actions">
              <a href={buildSurfaceHref('web', secondaryCta.to)} className="landing-secondary-button">
                {secondaryCta.label}
              </a>
              <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-link-button">
                Uygulamayi Ac
              </a>
            </div>
          </div>
        </div>

        <div className="website-auth-panel">{children}</div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default WebsiteAuthShell;
