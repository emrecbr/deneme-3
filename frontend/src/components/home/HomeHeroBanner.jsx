const resolveAssetUrl = (url, assetBaseUrl = '') => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(assetBaseUrl || '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function HomeHeroBanner({ banner, assetBaseUrl, onNavigate }) {
  if (!banner?.enabled) {
    return null;
  }

  const imageUrl = resolveAssetUrl(banner.imageUrl, assetBaseUrl);
  const title = banner.title || 'Talebini daha hızlı tamamla';
  const subtitle = banner.subtitle || 'Yakındaki açık talepleri keşfet ve doğru tekliflere daha hızlı ulaş.';
  const ctaLabel = banner.ctaLabel || '';
  const hasCta = Boolean(ctaLabel && banner.ctaPath);

  return (
    <section
      className={`home-hero-banner ${banner.overlayEnabled === false ? 'home-hero-banner--plain' : 'home-hero-banner--overlay'}`}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <div className="home-hero-banner__content">
        <span className="home-hero-banner__eyebrow">Talepet</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {hasCta ? (
          <button type="button" className="home-hero-banner__cta" onClick={() => onNavigate?.(banner.ctaPath)}>
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
