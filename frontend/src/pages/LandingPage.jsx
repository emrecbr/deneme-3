import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import { LANDING_CONTENT } from '../content/landingContent';
import { APP_HOME_PATH, APP_LOGIN_PATH, APP_REGISTER_PATH, buildSurfaceHref } from '../config/surfaces';

const ensureMetaDescription = () => {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  return tag;
};

function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = ensureMetaDescription();
    const previousDescription = descriptionTag.getAttribute('content') || '';

    document.title = LANDING_CONTENT.title;
    descriptionTag.setAttribute('content', LANDING_CONTENT.description);

    return () => {
      document.title = previousTitle;
      descriptionTag.setAttribute('content', previousDescription);
    };
  }, []);

  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <Link to="/" className="landing-brand">
          Talepet
        </Link>

        <nav className="landing-topbar-actions" aria-label="Website auth actions">
          <Link to={APP_LOGIN_PATH} className="landing-link-button">
            Giris Yap
          </Link>
          <Link to={APP_REGISTER_PATH} className="landing-primary-button">
            Kayit Ol
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{LANDING_CONTENT.hero.eyebrow}</p>
          <h1>{LANDING_CONTENT.hero.title}</h1>
          <p>{LANDING_CONTENT.hero.subtitle}</p>
          <div className="landing-cta-row">
            <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
              {LANDING_CONTENT.hero.primaryCta.label}
            </a>
            <Link to={LANDING_CONTENT.hero.secondaryCta.to} className="landing-secondary-button">
              {LANDING_CONTENT.hero.secondaryCta.label}
            </Link>
            <Link to={LANDING_CONTENT.hero.tertiaryCta.to} className="landing-link-button landing-link-button-strong">
              {LANDING_CONTENT.hero.tertiaryCta.label}
            </Link>
          </div>
        </div>

        <aside className="landing-hero-card" aria-label="Talepet one cikan faydalar">
          {LANDING_CONTENT.sections.map((section) => (
            <div key={section.title} className="landing-feature-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </aside>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Ana segmentler</p>
          <h2>Ihtiyacina gore dogru yuzeyi kullan</h2>
          <p>
            Talepet uygulama yuzeyi, farkli ihtiyac alanlarini segment bazli kategori yapisiyla yonetir ve
            kullaniciyi daha dogru tekliflere tasir.
          </p>
        </div>

        <div className="landing-segment-grid">
          {LANDING_CONTENT.segments.map((segment) => (
            <article key={segment.key} className="landing-segment-card">
              <h3>{segment.label}</h3>
              <p>{segment.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-soft">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Guven ve kolaylik</p>
          <h2>Kurumsal gorunum degil, calisan uygulama odagi</h2>
          <p>
            Talepet&apos;in mevcut mobil-first akisi korunur. Web yuzeyi ise kullaniciyi dogru giris noktasina tasiyan,
            guven veren ve kurumsal bilgileri gorunur kilan ayri bir katman olarak calisir.
          </p>
        </div>

        <div className="landing-trust-grid">
          {LANDING_CONTENT.trustPoints.map((point) => (
            <div key={point} className="landing-trust-item">
              <span className="landing-trust-dot" aria-hidden="true" />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-footer-cta">
        <div>
          <p className="landing-eyebrow">Uygulama yuzeyi</p>
          <h2>{LANDING_CONTENT.footerCta.title}</h2>
          <p>{LANDING_CONTENT.footerCta.body}</p>
        </div>

        <div className="landing-cta-row">
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
            {LANDING_CONTENT.footerCta.primary.label}
          </a>
          <Link to={LANDING_CONTENT.footerCta.secondary.to} className="landing-secondary-button">
            {LANDING_CONTENT.footerCta.secondary.label}
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default LandingPage;
