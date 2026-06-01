import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HERO_AUTOPLAY_INTERVAL_MS = 3000;
const HERO_SCROLL_SETTLE_MS = 120;

const resolveAssetUrl = (url, assetBaseUrl = '') => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(assetBaseUrl || '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

const normalizeSlides = (slides, banner) => {
  const sourceSlides = Array.isArray(slides) && slides.length ? slides : banner ? [banner] : [];
  return sourceSlides
    .map((slide, index) => ({
      key: slide.key || `hero-slide-${index}`,
      enabled: slide.enabled !== false,
      tabLabel: slide.tabLabel || slide.title || `Hero ${index + 1}`,
      title: slide.title || 'Talebini daha hızlı tamamla',
      subtitle: slide.subtitle || 'Yakındaki açık talepleri keşfet ve doğru tekliflere daha hızlı ulaş.',
      ctaLabel: slide.ctaLabel || '',
      ctaPath: slide.ctaPath || '',
      imageUrl: slide.imageUrl || '',
      overlayEnabled: slide.overlayEnabled !== false,
      sortOrder: Number.isFinite(Number(slide.sortOrder)) ? Number(slide.sortOrder) : (index + 1) * 10
    }))
    .filter((slide) => slide.enabled !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
};

export default function HomeHeroBanner({ banner, slides, assetBaseUrl, onNavigate }) {
  const trackRef = useRef(null);
  const scrollSettleTimerRef = useRef(null);
  const autoplayTimerRef = useRef(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const heroSlides = useMemo(() => normalizeSlides(slides, banner), [slides, banner]);

  const setSyncedActiveIndex = useCallback((nextIndex) => {
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    setSyncedActiveIndex(Math.min(activeIndexRef.current, Math.max(heroSlides.length - 1, 0)));
  }, [heroSlides.length, setSyncedActiveIndex]);

  useEffect(() => () => {
    window.clearTimeout(scrollSettleTimerRef.current);
    window.clearInterval(autoplayTimerRef.current);
  }, []);

  const handleScroll = () => {
    const node = trackRef.current;
    if (!node) return;
    window.clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = window.setTimeout(() => {
      const nextIndex = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1));
      setSyncedActiveIndex(Math.min(Math.max(nextIndex, 0), heroSlides.length - 1));
    }, HERO_SCROLL_SETTLE_MS);
  };

  const scrollToSlide = useCallback((index, behavior = 'smooth', syncState = true) => {
    const node = trackRef.current;
    if (!node) return;
    const safeIndex = Math.min(Math.max(index, 0), Math.max(heroSlides.length - 1, 0));
    const target = node.children[safeIndex];
    const targetLeft = target ? target.offsetLeft - node.offsetLeft : node.clientWidth * safeIndex;
    node.scrollTo({
      left: Number.isFinite(targetLeft) ? targetLeft : node.clientWidth * safeIndex,
      behavior
    });
    if (syncState) {
      setSyncedActiveIndex(safeIndex);
    }
  }, [heroSlides.length, setSyncedActiveIndex]);

  useEffect(() => {
    window.clearInterval(autoplayTimerRef.current);
    if (heroSlides.length <= 1) {
      return undefined;
    }

    autoplayTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      const nextIndex = (activeIndexRef.current + 1) % heroSlides.length;
      scrollToSlide(nextIndex, 'smooth', false);
      setSyncedActiveIndex(nextIndex);
    }, HERO_AUTOPLAY_INTERVAL_MS);

    return () => {
      window.clearInterval(autoplayTimerRef.current);
    };
  }, [heroSlides.length, scrollToSlide, setSyncedActiveIndex]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden' && heroSlides.length > 1) {
        scrollToSlide(activeIndex, 'auto', false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeIndex, heroSlides.length, scrollToSlide]);

  if (!heroSlides.length) {
    return null;
  }

  return (
    <section className="home-hero-carousel" aria-label="Ana sayfa hero alanı">
      <div className="home-hero-carousel__track" ref={trackRef} onScroll={handleScroll}>
        {heroSlides.map((slide) => {
          const imageUrl = resolveAssetUrl(slide.imageUrl, assetBaseUrl);
          const hasCta = Boolean(slide.ctaLabel && slide.ctaPath);
          return (
            <article
              key={slide.key}
              className={`home-hero-banner ${slide.overlayEnabled === false ? 'home-hero-banner--plain' : 'home-hero-banner--overlay'}`}
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
            >
              <div className="home-hero-banner__content">
                <span className="home-hero-banner__eyebrow">{slide.tabLabel || 'Talepet'}</span>
                <h2>{slide.title}</h2>
                <p>{slide.subtitle}</p>
                {hasCta ? (
                  <button type="button" className="home-hero-banner__cta" onClick={() => onNavigate?.(slide.ctaPath)}>
                    {slide.ctaLabel}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {heroSlides.length > 1 ? (
        <div className="home-hero-carousel__dots" aria-label="Hero sekmeleri">
          {heroSlides.map((slide, index) => (
            <button
              type="button"
              key={slide.key}
              className={index === activeIndex ? 'is-active' : ''}
              aria-label={`${index + 1}. hero sekmesi`}
              onClick={() => scrollToSlide(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
