import AppSetting from '../models/AppSetting.js';
import { DEFAULT_CONTENT_PAYLOAD } from './adminContentController.js';

const getKey = (section) => `content_${section}`;

const normalizeHeroSlides = (value, fallbackBanner = {}) => {
  if (Array.isArray(value) && value.length) {
    return value.map((slide, index) => ({
      key: slide?.key || `hero-slide-${index + 1}`,
      enabled: slide?.enabled !== false,
      tabLabel: slide?.tabLabel || slide?.title || `Hero ${index + 1}`,
      title: slide?.title || fallbackBanner.title || '',
      subtitle: slide?.subtitle || fallbackBanner.subtitle || '',
      ctaLabel: slide?.ctaLabel || fallbackBanner.ctaLabel || '',
      ctaPath: slide?.ctaPath || fallbackBanner.ctaPath || '',
      imageUrl: slide?.imageUrl || '',
      overlayEnabled: slide?.overlayEnabled !== false,
      sortOrder: Number.isFinite(Number(slide?.sortOrder)) ? Number(slide.sortOrder) : (index + 1) * 10
    }));
  }

  return [
    {
      key: 'legacy-hero-slide',
      enabled: fallbackBanner.enabled !== false,
      tabLabel: fallbackBanner.title || 'Ana hero',
      title: fallbackBanner.title || '',
      subtitle: fallbackBanner.subtitle || '',
      ctaLabel: fallbackBanner.ctaLabel || '',
      ctaPath: fallbackBanner.ctaPath || '',
      imageUrl: fallbackBanner.imageUrl || '',
      overlayEnabled: fallbackBanner.overlayEnabled !== false,
      sortOrder: Number.isFinite(Number(fallbackBanner.sortOrder)) ? Number(fallbackBanner.sortOrder) : 10
    }
  ];
};

const mergeContentValue = (section, ...sources) => {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    Object.assign(merged, source);
    if (section === 'home') {
      merged.heroBanner = { ...(merged.heroBanner || {}), ...(source.heroBanner || {}) };
      merged.visualTheme = { ...(merged.visualTheme || {}), ...(source.visualTheme || {}) };
      const slideSource = Array.isArray(source.heroSlides) ? source.heroSlides : source.heroBanner ? [] : merged.heroSlides;
      merged.heroSlides = normalizeHeroSlides(slideSource, merged.heroBanner);
    }
  }
  return merged;
};

export const getContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT_PAYLOAD[section] || {};
    const doc = await AppSetting.findOne({ key: getKey(section) }).lean();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.status(200).json({ success: true, data: mergeContentValue(section, defaults, doc?.value || {}) });
  } catch (error) {
    return next(error);
  }
};
