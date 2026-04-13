import { Link } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import { APP_HOME_PATH, buildSurfaceHref } from '../config/surfaces';

function WebsiteAuthShell({
  eyebrow = 'Talepet hesabi',
  title = 'Talepet hesabina website icinden devam et',
  description = 'Website baglaminda giris yapabilir, kayit olabilir ve uygulamaya gecis zamanini kontrollu sekilde belirleyebilirsin.',
  children
}) {
  return (
    <div className="website-auth-shell">
      <header className="website-auth-topbar">
        <Link to="/" className="landing-brand">
          Talepet
        </Link>

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

          <div className="website-auth-points">
            <div className="website-auth-point">Website uzerinden auth baslar</div>
            <div className="website-auth-point">Ayni backend ve OTP akislari reuse edilir</div>
            <div className="website-auth-point">Uygulamaya gecis yalnizca gerektiginde yapilir</div>
          </div>
        </div>

        <div className="website-auth-panel">{children}</div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default WebsiteAuthShell;
