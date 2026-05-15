import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import { LANDING_CONTENT } from '../content/landingContent';
import { APP_HOME_PATH, buildSurfaceHref } from '../config/surfaces';

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

        <nav className="landing-topbar-actions" aria-label="Uygulama gecisi">
          <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
            Uygulamaya Gec
          </a>
        </nav>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">{LANDING_CONTENT.hero.eyebrow}</p>
            <h1 id="landing-hero-title">{LANDING_CONTENT.hero.title}</h1>
            <p>{LANDING_CONTENT.hero.subtitle}</p>

            <div className="landing-cta-row" aria-label="Uygulama gecisi">
              <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
                Uygulamaya Gec
              </a>
            </div>

            <div className="landing-metric-grid" aria-label="Uygulama avantajlari">
              {LANDING_CONTENT.hero.metrics.map((item) => (
                <div key={item.label} className="landing-metric-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="landing-highlight-list" aria-label="Temel faydalar">
              {LANDING_CONTENT.hero.highlights.map((item) => (
                <div key={item} className="landing-highlight-item">
                  <span className="landing-trust-dot" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="landing-hero-card" aria-label="Talepet uygulama faydalari">
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
            <h2 id="how-it-works-title">Talebini olustur, ilgili teklifleri uygulamada karsilastir.</h2>
            <p>
              Kullanici ihtiyacini kategori, konum ve aciklama bilgileriyle uygulamada olusturur. Talepet bu
              bilgileri daha ilgili tekliflerin gelmesine yardimci olacak sekilde duzenli bir akis haline getirir.
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
            <h2 id="categories-title">Farkli ihtiyaclar icin tek ve anlasilir talep mantigi.</h2>
            <p>
              Hizmet, urun, otomobil ve uzmanlik ihtiyaclari ayni temel deneyim icinde toplanir. Kullanici
              ihtiyacini netlestirir, hizmet verenler de daha dogru baglamla teklif sunar.
            </p>
          </div>

          <div className="landing-segment-grid">
            {LANDING_CONTENT.categories.map((segment) => (
              <article key={segment.key} className="landing-segment-card">
                <h3>{segment.label}</h3>
                <div className="landing-segment-cue">{segment.cue}</div>
                <p>{segment.detail}</p>
              </article>
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
                <h3>Kategori secimi</h3>
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
            <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
              Uygulamaya Gec
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
              <div className="landing-location-badge">Yerel eslesme</div>
              <h3>Konum bilgisi, daha isabetli teklif almanin ana parcalarindan biridir.</h3>
              <p>
                Talep detayinin lokasyonla birlikte verilmesi, kullanicinin daha uygun hizmet verenlere
                ulasmasini ve gelen teklifleri daha kolay degerlendirmesini saglar.
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
            <p className="landing-eyebrow">Talep ornekleri</p>
            <h2 id="rfq-preview-title">Farkli ihtiyaclar tek bir talep akisinda toplanir.</h2>
            <p>
              Talepet, kullanicinin ihtiyacini daha net anlatmasina ve gelen teklifleri daha duzenli
              karsilastirmasina yardimci olur.
            </p>
          </div>

          <div className="landing-rfq-preview-grid">
            {LANDING_CONTENT.publicDiscovery.rfqPreview.map((item) => (
              <article key={item.title} className="landing-rfq-preview-card">
                <div className="landing-rfq-preview-meta">{item.meta}</div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-section-soft" id="guven" aria-labelledby="trust-title">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Guven ve kolaylik</p>
            <h2 id="trust-title">Daha duzenli talep, daha net teklif, daha kolay takip.</h2>
            <p>
              Talepet kullanicinin ihtiyacini parcalara bolmeden tek akista toplar. Kategori, konum,
              aciklama ve teklif takibi ayni uygulama deneyiminde birlesir.
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
            <h2 id="faq-title">Talepet uygulamasini kullanmadan once bilmen gerekenler.</h2>
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

          <div className="landing-cta-row" aria-label="Uygulama gecisi">
            <a href={buildSurfaceHref('app', APP_HOME_PATH)} className="landing-primary-button">
              Uygulamaya Gec
            </a>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default LandingPage;
