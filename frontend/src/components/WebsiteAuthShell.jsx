import { useLocation } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import { APP_HOME_PATH, WEBSITE_LOGIN_PATH, WEBSITE_REGISTER_PATH, buildSurfaceHref } from '../config/surfaces';

function WebsiteAuthShell({
  eyebrow = 'Talepet hesabı',
  title = 'Talepet hesabına web sitesi içinden devam et',
  description = 'Web sitesi bağlamında giriş yapabilir, kayıt olabilir ve uygulamaya geçiş zamanını kontrollü şekilde belirleyebilirsin.',
  children
}) {
  const location = useLocation();
  const registerRoute = location.pathname === WEBSITE_REGISTER_PATH;
  const secondaryCta = registerRoute
    ? { to: WEBSITE_LOGIN_PATH, label: 'Giriş Yap' }
    : { to: WEBSITE_REGISTER_PATH, label: 'Kayıt Ol' };

  return (
    <div className="website-auth-shell">
      <header className="website-auth-topbar">
          <a href={buildSurfaceHref('web', '/')} className="landing-brand">
            Talepet
          </a>

        <div className="landing-topbar-actions">
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-secondary-button">
            Uygulamayı Aç
          </a>
        </div>
      </header>

      <section className="website-auth-hero">
        <div className="website-auth-copy">
          <p className="landing-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>

          <div className="website-auth-badges">
            <span className="website-auth-badge">Şehir ve ilçe odaklı</span>
            <span className="website-auth-badge">Moderasyon destekli</span>
            <span className="website-auth-badge">Teklif akışı hazır</span>
          </div>

          <div className="website-auth-points">
            <div className="website-auth-point">
              <strong>Website onboarding</strong>
              <span>Kayıt ve giriş adımları web sitesi dilini korur, gereksiz uygulama sıçraması olmaz.</span>
            </div>
            <div className="website-auth-point">
              <strong>Aynı auth altyapısı</strong>
              <span>E-posta, telefon, OTP ve sosyal auth mevcut backend akışlarıyla çalışır.</span>
            </div>
            <div className="website-auth-point">
              <strong>Kontrollü geçiş</strong>
              <span>Ürün kullanımı gerektiğinde uygulama tarafına geçiş bilinçli ve host-aware yapılır.</span>
            </div>
          </div>

          <div className="website-auth-side-card">
            <div>
              <p className="website-auth-side-eyebrow">Talepet ile neler yaparsın?</p>
              <h2>{registerRoute ? 'Dakikalar içinde hesap aç, teklif almaya hazır ol.' : 'Talep, teklif ve profil akışına aynı hesaptan devam et.'}</h2>
            </div>

            <ul className="website-auth-side-list">
              <li>Kategori bazlı talep oluştur ve doğru kişilere ulaş.</li>
              <li>Şehir ve ilçeye göre daha isabetli eşleşmeler gör.</li>
              <li>Moderasyon ve premium görünürlük katmanlarıyla daha güvenli ilerle.</li>
            </ul>

            <div className="website-auth-side-actions">
              <a href={buildSurfaceHref('web', secondaryCta.to)} className="landing-secondary-button">
                {secondaryCta.label}
              </a>
              <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-link-button">
                Uygulamayı Aç
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
