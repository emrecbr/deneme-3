import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import { LANDING_CONTENT } from '../content/landingContent';
import { APP_HOME_PATH, WEBSITE_CATEGORIES_PATH, WEBSITE_LOGIN_PATH, WEBSITE_REGISTER_PATH, buildSurfaceHref } from '../config/surfaces';

const ensureMetaTag = (selector, buildTag) => {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = buildTag();
    document.head.appendChild(tag);
  }
  return tag;
};

const ensureMetaDescription = () =>
  ensureMetaTag('meta[name="description"]', () => {
    const tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    return tag;
  });

const ensureCanonical = () =>
  ensureMetaTag('link[rel="canonical"]', () => {
    const tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    return tag;
  });

const ensureNamedMeta = (name) =>
  ensureMetaTag(`meta[name="${name}"]`, () => {
    const tag = document.createElement('meta');
    tag.setAttribute('name', name);
    return tag;
  });

const ensurePropertyMeta = (property) =>
  ensureMetaTag(`meta[property="${property}"]`, () => {
    const tag = document.createElement('meta');
    tag.setAttribute('property', property);
    return tag;
  });

function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = ensureMetaDescription();
    const previousDescription = descriptionTag.getAttribute('content') || '';
    const canonicalTag = ensureCanonical();
    const previousCanonical = canonicalTag.getAttribute('href') || '';
    const ogTitle = ensurePropertyMeta('og:title');
    const previousOgTitle = ogTitle.getAttribute('content') || '';
    const ogDescription = ensurePropertyMeta('og:description');
    const previousOgDescription = ogDescription.getAttribute('content') || '';
    const ogType = ensurePropertyMeta('og:type');
    const previousOgType = ogType.getAttribute('content') || '';
    const ogUrl = ensurePropertyMeta('og:url');
    const previousOgUrl = ogUrl.getAttribute('content') || '';
    const twitterCard = ensureNamedMeta('twitter:card');
    const previousTwitterCard = twitterCard.getAttribute('content') || '';
    const twitterTitle = ensureNamedMeta('twitter:title');
    const previousTwitterTitle = twitterTitle.getAttribute('content') || '';
    const twitterDescription = ensureNamedMeta('twitter:description');
    const previousTwitterDescription = twitterDescription.getAttribute('content') || '';

    const pageUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

    document.title = LANDING_CONTENT.title;
    descriptionTag.setAttribute('content', LANDING_CONTENT.description);
    canonicalTag.setAttribute('href', pageUrl);
    ogTitle.setAttribute('content', LANDING_CONTENT.title);
    ogDescription.setAttribute('content', LANDING_CONTENT.description);
    ogType.setAttribute('content', 'website');
    ogUrl.setAttribute('content', pageUrl);
    twitterCard.setAttribute('content', 'summary_large_image');
    twitterTitle.setAttribute('content', LANDING_CONTENT.title);
    twitterDescription.setAttribute('content', LANDING_CONTENT.description);

    return () => {
      document.title = previousTitle;
      descriptionTag.setAttribute('content', previousDescription);
      canonicalTag.setAttribute('href', previousCanonical);
      ogTitle.setAttribute('content', previousOgTitle);
      ogDescription.setAttribute('content', previousOgDescription);
      ogType.setAttribute('content', previousOgType);
      ogUrl.setAttribute('content', previousOgUrl);
      twitterCard.setAttribute('content', previousTwitterCard);
      twitterTitle.setAttribute('content', previousTwitterTitle);
      twitterDescription.setAttribute('content', previousTwitterDescription);
    };
  }, []);

  return (
    <div className="landing-shell">
      <a href="#landing-main" className="landing-skip-link">
        Icerige gec
      </a>

      <header className="landing-topbar">
        <Link to="/" className="landing-brand">
          Talepet
        </Link>

        <nav className="landing-topbar-actions" aria-label="Website auth actions">
          <a href={buildSurfaceHref('web', WEBSITE_LOGIN_PATH)} className="landing-link-button">
            Giris Yap
          </a>
          <a href={buildSurfaceHref('web', WEBSITE_REGISTER_PATH)} className="landing-primary-button">
            Kayit Ol
          </a>
        </nav>
      </header>

      <main id="landing-main">
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{LANDING_CONTENT.hero.eyebrow}</p>
          <h1 id="landing-hero-title">{LANDING_CONTENT.hero.title}</h1>
          <p>{LANDING_CONTENT.hero.subtitle}</p>

          <div className="landing-cta-row" aria-label="Hero eylemleri">
            <Link to={LANDING_CONTENT.hero.primaryCta.to} className="landing-primary-button">
              {LANDING_CONTENT.hero.primaryCta.label}
            </Link>
            <Link to={LANDING_CONTENT.hero.secondaryCta.to} className="landing-secondary-button">
              {LANDING_CONTENT.hero.secondaryCta.label}
            </Link>
            <a
              href={buildSurfaceHref('app', APP_HOME_PATH)}
              className="landing-link-button landing-link-button-strong"
            >
              {LANDING_CONTENT.hero.tertiaryCta.label}
            </a>
          </div>

          <div className="landing-metric-grid" aria-label="Platform highlights">
            {LANDING_CONTENT.hero.metrics.map((item) => (
              <div key={item.label} className="landing-metric-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="landing-highlight-list" aria-label="Temel deger onerileri">
            {LANDING_CONTENT.hero.highlights.map((item) => (
              <div key={item} className="landing-highlight-item">
                <span className="landing-trust-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="landing-hero-card" aria-label="Talepet one cikan faydalar">
          {LANDING_CONTENT.featuredBenefits.map((section) => (
            <div key={section.title} className="landing-feature-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </aside>
      </section>

      <section className="landing-section" id="nasil-calisir" aria-labelledby="how-it-works-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Talepet nasil calisir</p>
          <h2 id="how-it-works-title">Website bilgilendirir, uygulama islemi tamamlar.</h2>
          <p>
            Bu website yuzeyi kullaniciya platformun mantigini aciklar. Talep olusturma, teklif toplama ve
            profil yonetimi ise uygulama tarafinda devam eder.
          </p>
        </div>

        <div className="landing-process-grid">
          {LANDING_CONTENT.howItWorks.map((item) => (
            <article key={item.step} className="landing-process-card">
              <span className="landing-process-step">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-soft" id="kategoriler" aria-labelledby="categories-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Populer kategoriler</p>
          <h2 id="categories-title">Farkli ihtiyaclar icin tek bir talep mantigi.</h2>
          <p>
            Talepet segmentleri farkli problem tiplerini tek tasarim dili icinde toplar. Kullanim mantigi sabit
            kalir, kategori ve akisin ayrintisi ihtiyaca gore degisir.
          </p>
        </div>

        <div className="landing-segment-grid">
          {LANDING_CONTENT.categories.map((segment) => (
            <Link key={segment.key} to={WEBSITE_CATEGORIES_PATH} className="landing-segment-card landing-segment-card--link">
              <h3>{segment.label}</h3>
              <div className="landing-segment-cue">{segment.cue}</div>
              <p>{segment.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section" id="kesif" aria-labelledby="discovery-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">{LANDING_CONTENT.publicDiscovery.eyebrow}</p>
          <h2 id="discovery-title">{LANDING_CONTENT.publicDiscovery.title}</h2>
          <p>{LANDING_CONTENT.publicDiscovery.body}</p>
        </div>

        <div className="landing-discovery-layout">
          <article className="landing-discovery-card landing-discovery-card--categories">
            <div className="landing-discovery-head">
              <h3>Kategori kesfi</h3>
              <p>{LANDING_CONTENT.publicDiscovery.categoriesIntro}</p>
            </div>

            <div className="landing-discovery-tags">
              {LANDING_CONTENT.categories.map((segment) => (
                <div key={segment.key} className="landing-discovery-tag">
                  <strong>{segment.label}</strong>
                  <span>{segment.cue}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="landing-discovery-card landing-discovery-card--cities">
            <div className="landing-discovery-head">
              <h3>Sehir / ilce baglami</h3>
              <p>{LANDING_CONTENT.publicDiscovery.cityIntro}</p>
            </div>

            <div className="landing-city-preview-list">
              {LANDING_CONTENT.publicDiscovery.featuredCities.map((item) => (
                <div key={item.city} className="landing-city-preview-card">
                  <div className="landing-city-preview-badge">{item.city}</div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="landing-discovery-cta-row">
          <Link to={LANDING_CONTENT.publicDiscovery.detailCta.to} className="landing-secondary-button">
            {LANDING_CONTENT.publicDiscovery.detailCta.label}
          </Link>
          <Link to={LANDING_CONTENT.publicDiscovery.createCta.to} className="landing-primary-button">
            {LANDING_CONTENT.publicDiscovery.createCta.label}
          </Link>
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-link-button">
            {LANDING_CONTENT.publicDiscovery.appCta.label}
          </a>
        </div>
      </section>

      <section className="landing-section" id="konum" aria-labelledby="location-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">{LANDING_CONTENT.locationLogic.eyebrow}</p>
          <h2 id="location-title">{LANDING_CONTENT.locationLogic.title}</h2>
          <p>{LANDING_CONTENT.locationLogic.body}</p>
        </div>

        <div className="landing-location-layout">
          <div className="landing-location-card">
            <div className="landing-location-badge">Yerel mantik</div>
            <h3>Sehir ve ilce verisi yalnizca filtre degil, is kalitesinin parcasi.</h3>
            <p>
              Talep detayinin lokasyonla birlikte anlam kazanmasi; kullanicinin daha dogru teklif toplamasina,
              karsidaki tarafin da daha net cevap vermesine yardimci olur.
            </p>
          </div>

          <div className="landing-location-points">
            {LANDING_CONTENT.locationLogic.bullets.map((item) => (
              <div key={item} className="landing-trust-item">
                <span className="landing-trust-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-location-spotlight">
          {LANDING_CONTENT.locationLogic.spotlight.map((item) => (
            <article key={item} className="landing-location-spotlight-card">
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-soft" id="rfq-preview" aria-labelledby="rfq-preview-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Talep preview</p>
          <h2 id="rfq-preview-title">RFQ mantigini public web icinde hisset.</h2>
          <p>
            Giris yapmadan tum urun akisina girmeden once, Talepet&apos;te bir talebin nasil gorunecegine ve
            hangi baglamla zenginlesecegine dair public-safe on izleme katmani gorebilirsin.
          </p>
        </div>

        <div className="landing-rfq-preview-grid">
          {LANDING_CONTENT.publicDiscovery.rfqPreview.map((item) => (
            <article key={item.title} className="landing-rfq-preview-card">
              <div className="landing-rfq-preview-meta">{item.meta}</div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="landing-rfq-preview-actions">
                <Link to={item.to} className="landing-secondary-button">
                  {item.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-soft" id="guven" aria-labelledby="trust-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Guven ve kalite</p>
          <h2 id="trust-title">Dogrulama, moderasyon ve premium gorunurluk ayni catida.</h2>
          <p>
            Talepet yalnizca listeleme veya form toplama araci olarak degil; kalite, operasyon ve gorunurluk
            katmanlariyla birlikte tasarlanmis bir sistem olarak konumlanir.
          </p>
        </div>

        <div className="landing-trust-pillar-grid">
          {LANDING_CONTENT.trustPillars.map((point) => (
            <article key={point.title} className="landing-trust-pillar">
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="sss" aria-labelledby="faq-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">SSS</p>
          <h2 id="faq-title">Karar vermeden once en kritik sorulari cevaplayalim.</h2>
        </div>

        <div className="landing-faq-grid">
          {LANDING_CONTENT.faq.map((item) => (
            <article key={item.question} className="landing-faq-card">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-footer-cta" aria-labelledby="footer-cta-title">
        <div>
          <p className="landing-eyebrow">{LANDING_CONTENT.footerCta.eyebrow}</p>
          <h2 id="footer-cta-title">{LANDING_CONTENT.footerCta.title}</h2>
          <p>{LANDING_CONTENT.footerCta.body}</p>
        </div>

        <div className="landing-cta-row" aria-label="Footer eylemleri">
          <Link to={LANDING_CONTENT.footerCta.primary.to} className="landing-primary-button">
            {LANDING_CONTENT.footerCta.primary.label}
          </Link>
          <Link to={LANDING_CONTENT.footerCta.secondary.to} className="landing-secondary-button">
            {LANDING_CONTENT.footerCta.secondary.label}
          </Link>
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-link-button">
            {LANDING_CONTENT.footerCta.tertiary.label}
          </a>
        </div>
      </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default LandingPage;
