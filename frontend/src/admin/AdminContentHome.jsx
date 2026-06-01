import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';
import { buildSurfaceHref } from '../config/surfaces';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const SEGMENTS = [
  { value: '', label: 'Genel' },
  { value: 'goods', label: 'Eşya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan' }
];
const SECTION_SOURCES = [
  { value: 'featured', label: 'Öne çıkan' },
  { value: 'nearby', label: 'Yakındaki' },
  { value: 'latest', label: 'Son eklenen' },
  { value: 'premium', label: 'Premium' }
];

const HERO_TITLE_LIMIT = 80;
const HERO_SUBTITLE_LIMIT = 120;
const HERO_CTA_LIMIT = 30;
const HOME_ASSET_UPLOAD_TIMEOUT_MS = 60000;
const HOME_ASSET_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const HOME_HERO_SOURCE_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const HOME_HERO_TARGET_WIDTH = 1200;
const HOME_HERO_TARGET_HEIGHT = 600;
const HOME_HERO_TARGET_SIZE_BYTES = 1024 * 1024;
const HOME_HERO_WEBP_QUALITIES = [0.82, 0.75, 0.68];
const HOME_ASSET_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const resolveAppHomePreviewHref = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/app';
    }
    if (hostname === 'admin.talepet.net.tr') {
      return 'https://app.talepet.net.tr/app';
    }
  }
  return buildSurfaceHref('app', '/app') || '/app';
};
const APP_HOME_PREVIEW_HREF = resolveAppHomePreviewHref();

const presetQuickCategories = (items) =>
  items.map((item, index) => ({
    key: `preset-quick-${item.label.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    label: item.label,
    segment: item.segment || '',
    categoryId: '',
    iconUrl: '',
    backgroundColor: item.backgroundColor || '#F8F6F2',
    enabled: true,
    sortOrder: (index + 1) * 10
  }));

const presetSections = (items) =>
  items.map((item, index) => ({
    key: `preset-section-${item.title.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    title: item.title,
    subtitle: item.subtitle || '',
    enabled: true,
    source: item.source || 'latest',
    sortOrder: (index + 1) * 10
  }));

const HOME_VISUAL_PRESETS = [
  {
    key: 'premium-general',
    name: 'Premium Ana Sayfa',
    description: 'Genel kullanım için dengeli ana sayfa tasarımı.',
    useCase: 'Genel kullanım, yeni kullanıcı karşılama ve hızlı talep oluşturma.',
    accent: '#3478F6',
    form: {
      heroTitle: 'Aramakla uğraşma, talebini oluştur.',
      heroSubtitle: 'İhtiyacını paylaş, yakınındaki teklifleri hızlıca gör.',
      heroBanner: {
        enabled: true,
        title: 'Aramakla uğraşma, talebini oluştur.',
        subtitle: 'İhtiyacını paylaş, yakınındaki teklifleri hızlıca gör.',
        ctaLabel: 'Talep Oluştur',
        ctaPath: '/create',
        imageUrl: '',
        overlayEnabled: true,
        sortOrder: 10
      },
      quickCategories: presetQuickCategories([
        { label: 'Eşya', segment: 'goods', backgroundColor: '#FEF3C7' },
        { label: 'Hizmet', segment: 'service', backgroundColor: '#DBEAFE' },
        { label: 'Otomobil', segment: 'auto', backgroundColor: '#E0F2FE' },
        { label: 'İş Arayan', segment: 'jobseeker', backgroundColor: '#F3E8FF' }
      ]),
      homeSections: presetSections([
        { title: 'Yakındaki Talepler', subtitle: 'Konumuna yakın açık talepleri keşfet.', source: 'nearby' },
        { title: 'Öne Çıkan Talepler', subtitle: 'Daha görünür yayınlanan talepler.', source: 'featured' },
        { title: 'Son Eklenenler', subtitle: 'Yeni yayınlanan talepler.', source: 'latest' }
      ]),
      visualTheme: {
        background: '#F5F1EA',
        cardRadius: 28,
        useSoftCards: true
      }
    }
  },
  {
    key: 'service-focused',
    name: 'Usta / Hizmet Odaklı',
    description: 'Hizmet ve usta taleplerini öne çıkaran tasarım.',
    useCase: 'Hizmet talebi oluşturmayı artırmak istediğin dönemler.',
    accent: '#0EA5E9',
    form: {
      heroTitle: 'Usta aramak yerine talebini oluştur.',
      heroSubtitle: 'Yakınındaki uygun hizmet verenlerden hızlıca teklif al.',
      heroBanner: {
        enabled: true,
        title: 'Usta aramak yerine talebini oluştur.',
        subtitle: 'Yakınındaki uygun hizmet verenlerden hızlıca teklif al.',
        ctaLabel: 'Hizmet Talebi Oluştur',
        ctaPath: '/create',
        imageUrl: '',
        overlayEnabled: true,
        sortOrder: 10
      },
      quickCategories: presetQuickCategories([
        { label: 'Elektrik', segment: 'service', backgroundColor: '#DBEAFE' },
        { label: 'Tesisat', segment: 'service', backgroundColor: '#CCFBF1' },
        { label: 'Boya', segment: 'service', backgroundColor: '#EDE9FE' },
        { label: 'Temizlik', segment: 'service', backgroundColor: '#DCFCE7' }
      ]),
      homeSections: presetSections([
        { title: 'Yakındaki Hizmet Talepleri', subtitle: 'Konumuna yakın hizmet ihtiyaçları.', source: 'nearby' },
        { title: 'En Çok İlgi Görenler', subtitle: 'Öne çıkan hizmet talepleri.', source: 'featured' },
        { title: 'Yeni Hizmet Talepleri', subtitle: 'Son yayınlanan hizmet talepleri.', source: 'latest' }
      ]),
      visualTheme: {
        background: '#F2F8FA',
        cardRadius: 28,
        useSoftCards: true
      }
    }
  },
  {
    key: 'goods-second-hand',
    name: 'Eşya Odaklı',
    description: 'Eşya ve ikinci el taleplerini öne çıkaran tasarım.',
    useCase: 'Eşya taleplerini ve ikinci el kullanım senaryosunu öne çıkarmak için.',
    accent: '#F59E0B',
    form: {
      heroTitle: 'Evindeki fazlalık başkasının ihtiyacı olabilir.',
      heroSubtitle: 'Eşya taleplerini keşfet, ihtiyacını kolayca paylaş.',
      heroBanner: {
        enabled: true,
        title: 'Evindeki fazlalık başkasının ihtiyacı olabilir.',
        subtitle: 'Eşya taleplerini keşfet, ihtiyacını kolayca paylaş.',
        ctaLabel: 'Eşya Talebi Oluştur',
        ctaPath: '/create',
        imageUrl: '',
        overlayEnabled: true,
        sortOrder: 10
      },
      quickCategories: presetQuickCategories([
        { label: 'Mobilya', segment: 'goods', backgroundColor: '#FEF3C7' },
        { label: 'Elektronik', segment: 'goods', backgroundColor: '#E0F2FE' },
        { label: 'Ev Eşyası', segment: 'goods', backgroundColor: '#FDE68A' },
        { label: 'Bebek', segment: 'goods', backgroundColor: '#FCE7F3' }
      ]),
      homeSections: presetSections([
        { title: 'Eşya Talepleri', subtitle: 'Eşya ve ürün ihtiyaçlarını gör.', source: 'featured' },
        { title: 'Yakındaki İlanlar', subtitle: 'Yakınındaki eşya talepleri.', source: 'nearby' },
        { title: 'Yeni Eklenenler', subtitle: 'Son eklenen eşya talepleri.', source: 'latest' }
      ]),
      visualTheme: {
        background: '#F8F1E7',
        cardRadius: 28,
        useSoftCards: true
      }
    }
  },
  {
    key: 'location-nearby',
    name: 'Konum Odaklı',
    description: 'Yakındaki talepleri keşfetmeyi ön plana çıkarır.',
    useCase: 'Yakındaki talepleri, konum keşfini ve şehir bazlı kullanımı vurgulamak için.',
    accent: '#14B8A6',
    form: {
      heroTitle: 'Yakınındaki talepleri keşfet.',
      heroSubtitle: 'Şehir, ilçe ve konumuna göre en yakın talepleri gör.',
      heroBanner: {
        enabled: true,
        title: 'Yakınındaki talepleri keşfet.',
        subtitle: 'Şehir, ilçe ve konumuna göre en yakın talepleri gör.',
        ctaLabel: 'Konumuna Göre Keşfet',
        ctaPath: '/app',
        imageUrl: '',
        overlayEnabled: true,
        sortOrder: 10
      },
      quickCategories: presetQuickCategories([
        { label: 'Yakınımdakiler', segment: '', backgroundColor: '#CCFBF1' },
        { label: 'Şehir Geneli', segment: '', backgroundColor: '#DBEAFE' },
        { label: 'Hizmetler', segment: 'service', backgroundColor: '#E0F2FE' },
        { label: 'Eşyalar', segment: 'goods', backgroundColor: '#FEF3C7' }
      ]),
      homeSections: presetSections([
        { title: 'Sana Yakın Talepler', subtitle: 'Konumuna göre öne çıkan talepler.', source: 'nearby' },
        { title: 'Şehrindeki Talepler', subtitle: 'Seçili şehirdeki güncel talepler.', source: 'featured' },
        { title: 'Yeni Talepler', subtitle: 'Yeni yayınlanan yakın talepler.', source: 'latest' }
      ]),
      visualTheme: {
        background: '#EEF8F6',
        cardRadius: 28,
        useSoftCards: true
      }
    }
  },
  {
    key: 'minimal-launch',
    name: 'Minimal Lansman Şablonu',
    description: 'Sade, temiz ve lansman dönemine uygun ana sayfa.',
    useCase: 'Az metinli, hızlı anlaşılır ve yeni kullanıcıya uygun giriş ekranı.',
    accent: '#7C5CFF',
    form: {
      heroTitle: 'Talepet ile ihtiyacını kolayca paylaş.',
      heroSubtitle: 'Talep oluştur, teklifleri karşılaştır, hızlıca iletişime geç.',
      heroBanner: {
        enabled: true,
        title: 'Talepet ile ihtiyacını kolayca paylaş.',
        subtitle: 'Talep oluştur, teklifleri karşılaştır, hızlıca iletişime geç.',
        ctaLabel: 'Hemen Başla',
        ctaPath: '/create',
        imageUrl: '',
        overlayEnabled: true,
        sortOrder: 10
      },
      quickCategories: presetQuickCategories([
        { label: 'Eşya', segment: 'goods', backgroundColor: '#FEF3C7' },
        { label: 'Hizmet', segment: 'service', backgroundColor: '#DBEAFE' },
        { label: 'Otomobil', segment: 'auto', backgroundColor: '#E0E7FF' },
        { label: 'İş', segment: 'jobseeker', backgroundColor: '#F3E8FF' }
      ]),
      homeSections: presetSections([
        { title: 'Öne Çıkanlar', subtitle: 'Daha görünür talepleri keşfet.', source: 'featured' },
        { title: 'Son Eklenenler', subtitle: 'Yeni yayınlanan talepler.', source: 'latest' }
      ]),
      visualTheme: {
        background: '#F8F6F2',
        cardRadius: 24,
        useSoftCards: true
      }
    }
  }
];

const defaultForm = {
  heroTitle: 'Talepet ile hızlı talep oluştur',
  heroSubtitle: 'Bulunduğun bölgede teklifleri keşfet.',
  layoutVariant: 'premium_mobile_v1',
  heroBanner: {
    enabled: true,
    title: 'Talebini daha hızlı tamamla',
    subtitle: 'Yakındaki açık talepleri keşfet, ihtiyacını paylaş ve doğru tekliflere daha hızlı ulaş.',
    ctaLabel: 'Talep Oluştur',
    ctaPath: '/create',
    imageUrl: '',
    overlayEnabled: true,
    sortOrder: 10
  },
  heroSlides: [],
  quickCategories: [],
  homeSections: [],
  visualTheme: {
    background: '#F5F1EA',
    cardRadius: 28,
    useSoftCards: true
  }
};

const emptyCategory = (index = 0) => ({
  key: `quick-${Date.now()}-${index}`,
  label: '',
  segment: '',
  categoryId: '',
  iconUrl: '',
  backgroundColor: '#F8F6F2',
  enabled: true,
  sortOrder: (index + 1) * 10
});

const emptySection = (index = 0) => ({
  key: `section-${Date.now()}-${index}`,
  title: '',
  subtitle: '',
  enabled: true,
  source: 'latest',
  sortOrder: (index + 1) * 10
});

const makeHeroSlide = (banner = {}, index = 0) => ({
  key: banner.key || `hero-slide-${Date.now()}-${index}`,
  enabled: banner.enabled !== false,
  tabLabel: banner.tabLabel || banner.title || `Hero ${index + 1}`,
  title: banner.title || '',
  subtitle: banner.subtitle || '',
  ctaLabel: banner.ctaLabel || '',
  ctaPath: banner.ctaPath || '',
  imageUrl: banner.imageUrl || '',
  overlayEnabled: banner.overlayEnabled !== false,
  sortOrder: Number.isFinite(Number(banner.sortOrder)) ? Number(banner.sortOrder) : (index + 1) * 10
});

const getSortedHeroSlides = (slides = []) =>
  [...slides].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

const normalizeHeroSlides = (payload = {}) => {
  if (Array.isArray(payload.heroSlides) && payload.heroSlides.length) {
    return payload.heroSlides.map((slide, index) => makeHeroSlide(slide, index));
  }
  return [makeHeroSlide({ ...defaultForm.heroBanner, ...(payload.heroBanner || {}) }, 0)];
};

const getPrimaryHeroSlide = (slides = []) => {
  const sorted = getSortedHeroSlides(slides);
  return sorted.find((slide) => slide.enabled !== false) || sorted[0] || makeHeroSlide(defaultForm.heroBanner, 0);
};

const syncHeroBannerFromSlides = (formValue) => {
  const primarySlide = getPrimaryHeroSlide(formValue.heroSlides);
  return {
    ...formValue,
    heroTitle: primarySlide.title ?? formValue.heroTitle ?? '',
    heroSubtitle: primarySlide.subtitle ?? formValue.heroSubtitle ?? '',
    heroBanner: {
      ...formValue.heroBanner,
      enabled: primarySlide.enabled !== false,
      title: primarySlide.title ?? formValue.heroBanner?.title ?? '',
      subtitle: primarySlide.subtitle ?? formValue.heroBanner?.subtitle ?? '',
      ctaLabel: primarySlide.ctaLabel ?? formValue.heroBanner?.ctaLabel ?? '',
      ctaPath: primarySlide.ctaPath ?? formValue.heroBanner?.ctaPath ?? '',
      imageUrl: primarySlide.imageUrl ?? formValue.heroBanner?.imageUrl ?? '',
      overlayEnabled: primarySlide.overlayEnabled !== false,
      sortOrder: Number.isFinite(Number(primarySlide.sortOrder)) ? Number(primarySlide.sortOrder) : formValue.heroBanner?.sortOrder || 10
    }
  };
};

const normalizeForm = (payload = {}) => {
  const baseForm = {
    ...defaultForm,
    ...payload,
    heroBanner: { ...defaultForm.heroBanner, ...(payload.heroBanner || {}) },
    visualTheme: { ...defaultForm.visualTheme, ...(payload.visualTheme || {}) },
    quickCategories: Array.isArray(payload.quickCategories) ? payload.quickCategories : defaultForm.quickCategories,
    homeSections: Array.isArray(payload.homeSections) ? payload.homeSections : defaultForm.homeSections
  };
  return syncHeroBannerFromSlides({
    ...baseForm,
    heroSlides: normalizeHeroSlides(baseForm)
  });
};

const buildAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

const inferMediaProvider = (url) => {
  if (!url) return '';
  return /res\.cloudinary\.com/i.test(url) ? 'cloudinary' : 'local';
};

const resolveUploadErrorMessage = (err) => {
  const message = String(err?.message || '');
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(message)) {
    return 'Görsel yükleme zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }
  if (
    message === 'Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.' ||
    message === 'Bu görsel çok büyük. Lütfen daha küçük bir görsel seçin.' ||
    message === 'Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.'
  ) {
    return message;
  }
  return err?.response?.data?.message || 'Görsel yüklenemedi. Lütfen tekrar deneyin.';
};

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.'));
        }
      },
      'image/webp',
      quality
    );
  });

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.'));
    };
    image.src = objectUrl;
  });

const resizeHeroImage = async (file) => {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = HOME_HERO_TARGET_WIDTH;
  canvas.height = HOME_HERO_TARGET_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const targetRatio = HOME_HERO_TARGET_WIDTH / HOME_HERO_TARGET_HEIGHT;
  const imageRatio = image.width / image.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else if (imageRatio < targetRatio) {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    HOME_HERO_TARGET_WIDTH,
    HOME_HERO_TARGET_HEIGHT
  );

  let outputBlob = null;
  for (const quality of HOME_HERO_WEBP_QUALITIES) {
    outputBlob = await canvasToBlob(canvas, quality);
    if (outputBlob.size <= HOME_HERO_TARGET_SIZE_BYTES) {
      return outputBlob;
    }
  }

  if (outputBlob && outputBlob.size <= HOME_ASSET_MAX_SIZE_BYTES) {
    return outputBlob;
  }

  throw new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.');
};

export default function AdminContentHome() {
  const heroFileInputRef = useRef(null);
  const latestHeroImageUrlRef = useRef(defaultForm.heroBanner.imageUrl);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [uploadStage, setUploadStage] = useState('');
  const [heroPreviewUrl, setHeroPreviewUrl] = useState('');
  const [publicContentCheck, setPublicContentCheck] = useState(null);
  const [lastUploadProvider, setLastUploadProvider] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState(HOME_VISUAL_PRESETS[0]?.key || '');
  const [selectedHeroSlideKey, setSelectedHeroSlideKey] = useState('');
  const [previewReloadKey, setPreviewReloadKey] = useState(Date.now());
  const [livePreviewLoading, setLivePreviewLoading] = useState(true);
  const [livePreviewError, setLivePreviewError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/content/home');
        if (!active) return;
        const nextForm = normalizeForm(response.data?.data || {});
        latestHeroImageUrlRef.current = nextForm.heroBanner?.imageUrl || '';
        setLastUploadProvider(inferMediaProvider(nextForm.heroBanner?.imageUrl));
        setForm(nextForm);
        setSelectedHeroSlideKey(nextForm.heroSlides?.[0]?.key || '');
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'İçerik alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (heroPreviewUrl) {
      URL.revokeObjectURL(heroPreviewUrl);
    }
  }, [heroPreviewUrl]);

  useEffect(() => {
    if (!livePreviewLoading) return undefined;
    const timer = window.setTimeout(() => {
      setLivePreviewLoading(false);
      setLivePreviewError(true);
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [livePreviewLoading, previewReloadKey]);

  const selectedPreset = useMemo(
    () => HOME_VISUAL_PRESETS.find((preset) => preset.key === selectedPresetKey) || HOME_VISUAL_PRESETS[0],
    [selectedPresetKey]
  );
  const selectedHeroSlide = useMemo(() => {
    const slides = Array.isArray(form.heroSlides) && form.heroSlides.length ? form.heroSlides : normalizeHeroSlides(form);
    return slides.find((slide) => slide.key === selectedHeroSlideKey) || slides[0] || makeHeroSlide(defaultForm.heroBanner, 0);
  }, [form, selectedHeroSlideKey]);
  const heroPreviewImage = heroPreviewUrl || buildAssetUrl(selectedHeroSlide.imageUrl || form.heroBanner.imageUrl);
  const livePreviewSrc = useMemo(() => {
    const separator = APP_HOME_PREVIEW_HREF.includes('?') ? '&' : '?';
    return `${APP_HOME_PREVIEW_HREF}${separator}homePreviewTs=${previewReloadKey}`;
  }, [previewReloadKey]);

  const refreshLivePreview = () => {
    setLivePreviewError(false);
    setLivePreviewLoading(true);
    setPreviewReloadKey(Date.now());
  };

  const updateHeroSlide = (slideKey, changes) => {
    setForm((prev) => {
      const heroSlides = (prev.heroSlides || []).map((slide) =>
        slide.key === slideKey ? { ...slide, ...changes } : slide
      );
      return syncHeroBannerFromSlides({ ...prev, heroSlides });
    });
  };

  const updateHero = (key, value) => {
    if (
      key === 'enabled' &&
      value === false &&
      selectedHeroSlide.enabled !== false &&
      (form.heroSlides || []).filter((slide) => slide.enabled !== false).length <= 1
    ) {
      setError('En az bir aktif hero sekmesi kalmalı.');
      return;
    }
    if (key === 'imageUrl') {
      latestHeroImageUrlRef.current = value || '';
    }
    updateHeroSlide(selectedHeroSlide.key, { [key]: value });
  };

  const updateHeroTitle = (value) => {
    updateHeroSlide(selectedHeroSlide.key, { title: value, tabLabel: selectedHeroSlide.tabLabel || value });
  };

  const updateHeroSubtitle = (value) => {
    updateHeroSlide(selectedHeroSlide.key, { subtitle: value });
  };

  const updateTheme = (key, value) => {
    setForm((prev) => ({ ...prev, visualTheme: { ...prev.visualTheme, [key]: value } }));
  };

  const updateQuickCategory = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      quickCategories: (prev.quickCategories || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const updateSection = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      homeSections: (prev.homeSections || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const addQuickCategory = () => {
    setForm((prev) => ({
      ...prev,
      quickCategories: [...(prev.quickCategories || []), emptyCategory(prev.quickCategories?.length || 0)]
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      homeSections: [...(prev.homeSections || []), emptySection(prev.homeSections?.length || 0)]
    }));
  };

  const removeQuickCategory = (index) => {
    setForm((prev) => ({
      ...prev,
      quickCategories: (prev.quickCategories || []).filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const removeSection = (index) => {
    setForm((prev) => ({
      ...prev,
      homeSections: (prev.homeSections || []).filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const applyPreset = (preset) => {
    if (!preset) return;
    if (!window.confirm('Mevcut ana sayfa ayarları bu şablonla değiştirilecek. Devam edilsin mi?')) {
      return;
    }
    setForm((prev) => {
      const preservedImageUrl = prev.heroBanner?.imageUrl || latestHeroImageUrlRef.current || '';
      const presetHeroSlide = makeHeroSlide({
        ...preset.form.heroBanner,
        imageUrl: preset.form.heroBanner?.imageUrl || preservedImageUrl,
        tabLabel: preset.name,
        key: `${preset.key}-hero-1`
      }, 0);
      const nextForm = normalizeForm({
        ...prev,
        ...preset.form,
        layoutVariant: 'premium_mobile_v1',
        heroBanner: {
          ...defaultForm.heroBanner,
          ...preset.form.heroBanner,
          imageUrl: preset.form.heroBanner?.imageUrl || preservedImageUrl
        },
        heroSlides: [presetHeroSlide],
        quickCategories: (preset.form.quickCategories || []).map((item) => ({ ...item })),
        homeSections: (preset.form.homeSections || []).map((item) => ({ ...item })),
        visualTheme: {
          ...defaultForm.visualTheme,
          ...(preset.form.visualTheme || {})
        }
      });
      latestHeroImageUrlRef.current = nextForm.heroBanner?.imageUrl || '';
      setSelectedHeroSlideKey(nextForm.heroSlides?.[0]?.key || '');
      return nextForm;
    });
    setSelectedPresetKey(preset.key);
    setHeroPreviewUrl('');
    setUploadStage('');
    setError('');
    setSuccess('Şablon forma uygulandı. Canlıya yansıtmak için Kaydet butonuna basın.');
  };

  const removeHeroImage = () => {
    latestHeroImageUrlRef.current = '';
    updateHeroSlide(selectedHeroSlide.key, { imageUrl: '' });
    setHeroPreviewUrl('');
    setUploadStage('');
    setLastUploadProvider('');
    setPublicContentCheck(null);
    setSuccess('Hero görseli kaldırıldı. Canlıya yansıtmak için Kaydet butonuna basın.');
  };

  const addHeroSlide = () => {
    setForm((prev) => {
      const nextIndex = prev.heroSlides?.length || 0;
      const newSlide = makeHeroSlide({
        key: `hero-slide-${Date.now()}-${nextIndex}`,
        tabLabel: `Sekme ${nextIndex + 1}`,
        title: '',
        subtitle: '',
        ctaLabel: 'Talep Oluştur',
        ctaPath: '/create',
        sortOrder: (nextIndex + 1) * 10
      }, nextIndex);
      setSelectedHeroSlideKey(newSlide.key);
      return syncHeroBannerFromSlides({ ...prev, heroSlides: [...(prev.heroSlides || []), newSlide] });
    });
    setHeroPreviewUrl('');
    setPublicContentCheck(null);
  };

  const removeHeroSlide = (slideKey) => {
    setForm((prev) => {
      const currentSlides = prev.heroSlides || [];
      if (currentSlides.length <= 1) {
        setError('En az bir hero sekmesi kalmalı.');
        return prev;
      }
      const nextSlides = currentSlides.filter((slide) => slide.key !== slideKey);
      if (!nextSlides.some((slide) => slide.enabled !== false) && nextSlides[0]) {
        nextSlides[0] = { ...nextSlides[0], enabled: true };
      }
      const nextSelected = nextSlides[0]?.key || '';
      setSelectedHeroSlideKey(nextSelected);
      setHeroPreviewUrl('');
      setPublicContentCheck(null);
      return syncHeroBannerFromSlides({ ...prev, heroSlides: nextSlides });
    });
  };

  const postAssetFile = async (file, target, index = null, fileName = file?.name || 'home-asset.webp') => {
    const payload = new FormData();
    payload.append('file', file, fileName);
    const response = await api.post('/admin/content/home/asset', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: HOME_ASSET_UPLOAD_TIMEOUT_MS
    });
    const uploadData = response.data?.data || {};
    const url = uploadData.url || '';
    if (!url) {
      throw new Error('Upload URL alınamadı.');
    }
    if (target === 'hero') {
      latestHeroImageUrlRef.current = url;
      setLastUploadProvider(uploadData.provider || inferMediaProvider(url));
      setForm((prev) => {
        const heroSlides = (prev.heroSlides || []).map((slide) =>
          slide.key === selectedHeroSlide.key ? { ...slide, imageUrl: url } : slide
        );
        return syncHeroBannerFromSlides({ ...prev, heroSlides });
      });
    } else if (target === 'quickCategory') {
      updateQuickCategory(index, 'iconUrl', url);
    }
    return { ...uploadData, url };
  };

  const uploadAsset = async (file, target, index = null) => {
    if (!file) return;
    if (!HOME_ASSET_ALLOWED_TYPES.has(file.type)) {
      setError('Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.');
      setSuccess('');
      return;
    }
    if (file.size > HOME_ASSET_MAX_SIZE_BYTES) {
      setError('Görsel boyutu en fazla 5MB olabilir.');
      setSuccess('');
      return;
    }
    setUploadingKey(index == null ? target : `${target}-${index}`);
    setError('');
    setSuccess('');
    try {
      await postAssetFile(file, target, index);
      setSuccess('Görsel yüklendi. Canlıya yansıtmak için Kaydet ve Yayınla butonuna basın.');
    } catch (err) {
      setError(resolveUploadErrorMessage(err));
    } finally {
      setUploadingKey('');
    }
  };

  const handleHeroImageSelect = async (file) => {
    if (!file) return;
    if (!HOME_ASSET_ALLOWED_TYPES.has(file.type)) {
      setError('Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.');
      setSuccess('');
      setUploadStage('');
      return;
    }
    if (file.size > HOME_HERO_SOURCE_MAX_SIZE_BYTES) {
      setError('Bu görsel çok büyük. Lütfen daha küçük bir görsel seçin.');
      setSuccess('');
      setUploadStage('');
      return;
    }

    setUploadingKey('hero');
    setError('');
    setSuccess('');
    setUploadStage('Görsel hazırlanıyor...');
    try {
      setUploadStage('Görsel şablona uyarlanıyor...');
      const optimizedBlob = await resizeHeroImage(file);
      if (optimizedBlob.size > HOME_ASSET_MAX_SIZE_BYTES) {
        throw new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.');
      }

      const localPreviewUrl = URL.createObjectURL(optimizedBlob);
      setHeroPreviewUrl(localPreviewUrl);
      setPublicContentCheck(null);
      setUploadStage('Görsel yükleniyor...');
      const uploadedAsset = await postAssetFile(optimizedBlob, 'hero', null, `home-hero-${Date.now()}.webp`);
      setUploadStage('Görsel hazır. Yayına almak için Kaydet ve Yayınla butonuna basın.');
      setSuccess(`Görsel hazır: ${uploadedAsset.url}. Yayına almak için Kaydet ve Yayınla butonuna basın.`);
    } catch (err) {
      setHeroPreviewUrl('');
      setUploadStage('');
      setError(resolveUploadErrorMessage(err));
    } finally {
      setUploadingKey('');
    }
  };

  const save = async () => {
    if (!window.confirm('Ana sayfa görsel yönetimi güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = syncHeroBannerFromSlides(normalizeForm(form));
      if (window.localStorage?.getItem('talepet:debug-home-content') === '1') {
        console.info('HOME_CONTENT_SAVE_PAYLOAD', payload);
      }
      const response = await api.patch('/admin/content/home', payload);
      const savedForm = normalizeForm(response.data?.data || payload);
      latestHeroImageUrlRef.current = savedForm.heroBanner?.imageUrl || '';
      setForm(savedForm);
      const publicResponse = await api.get(`/content/home?ts=${Date.now()}`);
      const publicForm = normalizeForm(publicResponse.data?.data || {});
      const savedTitle = savedForm.heroBanner?.title || '';
      const publicTitle = publicForm.heroBanner?.title || '';
      const savedImageUrl = savedForm.heroBanner?.imageUrl || '';
      const publicImageUrl = publicForm.heroBanner?.imageUrl || '';
      const publicImageProvider = lastUploadProvider || inferMediaProvider(publicImageUrl);
      const publicHeroSlides = Array.isArray(publicForm.heroSlides) ? publicForm.heroSlides : [];
      const activePublicHeroSlides = publicHeroSlides.filter((slide) => slide.enabled !== false);
      const firstActivePublicHeroSlide = getPrimaryHeroSlide(publicHeroSlides);
      const savedCategoryCount = Array.isArray(savedForm.quickCategories) ? savedForm.quickCategories.length : 0;
      const publicCategoryCount = Array.isArray(publicForm.quickCategories) ? publicForm.quickCategories.length : 0;
      const publicMatches =
        savedTitle === publicTitle &&
        savedImageUrl === publicImageUrl &&
        savedCategoryCount === publicCategoryCount;

      setPublicContentCheck({
        ok: publicMatches,
        checkedAt: new Date().toLocaleString('tr-TR'),
        savedTitle,
        publicTitle,
        savedImageUrl,
        publicImageUrl,
        publicImageFullUrl: buildAssetUrl(publicImageUrl),
        provider: publicImageProvider,
        publicHeroSlideCount: publicHeroSlides.length,
        publicActiveHeroSlideCount: activePublicHeroSlides.length,
        firstActiveSlideTitle: firstActivePublicHeroSlide?.title || '',
        firstActiveSlideImageUrl: firstActivePublicHeroSlide?.imageUrl || '',
        publicCategoryCount
      });
      if (savedImageUrl && !publicImageUrl) {
        setSuccess('Metinler kaydedildi ancak hero görsel URL public içerikte görünmüyor.');
      } else {
        setSuccess(
          publicMatches
            ? 'Kaydedildi. Public ana sayfa içeriği güncel. App yüzeyinde kontrol edebilirsiniz.'
            : 'Kaydedildi ancak public içerik henüz güncel görünmüyor. Cache veya deploy kontrolü gerekebilir.'
        );
      }
      refreshLivePreview();
    } catch (err) {
      setError(err?.response?.data?.message || 'İçerik güncellenemedi veya public içerik doğrulanamadı.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel admin-home-visuals">
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <>
            <div className="admin-home-builder-header">
              <div>
                <h2>Ana Sayfa Tasarımını Seç</h2>
                <p>
                  Uygulama ana sayfasının nasıl görüneceğini buradan seç. Bir şablon seç, görselini yükle, başlığı
                  düzenle ve kaydet.
                </p>
              </div>
              <a className="admin-btn admin-btn-secondary" href={APP_HOME_PREVIEW_HREF} target="_blank" rel="noreferrer">
                Siteyi Görüntüle
              </a>
            </div>

            <div className="admin-home-builder-layout admin-home-builder-layout--with-preview">
              <section className="admin-home-template-area" id="home-visual-presets">
                <div className="admin-home-section-heading">
                  <div>
                    <h3>Hazır Şablonlar</h3>
                  </div>
                  <span>5 şablon</span>
                </div>
                <div className="admin-home-template-grid">
                  {HOME_VISUAL_PRESETS.map((preset) => (
                    <article
                      key={preset.key}
                      className={`admin-home-template-card ${selectedPresetKey === preset.key ? 'is-selected' : ''}`}
                    >
                      {selectedPresetKey === preset.key ? <span className="admin-home-template-check">✓</span> : null}
                      <div className="admin-home-template-mock" style={{ '--preset-accent': preset.accent }}>
                        <div className="admin-home-template-mock-hero" />
                        <div className="admin-home-template-mock-search" />
                        <div className="admin-home-template-mock-cats">
                          {(preset.form.quickCategories || []).slice(0, 4).map((item) => (
                            <span key={item.key}>{String(item.label || '').slice(0, 1)}</span>
                          ))}
                        </div>
                        <div className="admin-home-template-mock-card" />
                      </div>
                      <strong>{preset.name}</strong>
                      <p>{preset.description}</p>
                      <button type="button" className="admin-btn" onClick={() => applyPreset(preset)}>
                        Seç ve Düzenle
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="admin-home-editor-panel">
                <div className="admin-home-editor-panel-head">
                  <div>
                    <span>Seçilen Şablon</span>
                    <strong>{selectedPreset?.name || 'Premium Ana Sayfa'}</strong>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => document.getElementById('home-visual-presets')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Şablonu Değiştir
                  </button>
                </div>

                <div className="admin-home-edit-block">
                  <div className="admin-home-edit-label">
                    <strong>Hero Sekmeleri</strong>
                    <span>Birden fazla hero mesajı ekleyin, sıralayın ve aktif/pasif yönetin.</span>
                  </div>
                  <div className="admin-home-slide-tabs">
                    {getSortedHeroSlides(form.heroSlides || []).map((slide, index) => (
                      <button
                        type="button"
                        key={slide.key}
                        className={`admin-home-slide-tab ${slide.key === selectedHeroSlide.key ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedHeroSlideKey(slide.key);
                          setHeroPreviewUrl('');
                        }}
                      >
                        <span className="admin-home-slide-thumb" style={slide.imageUrl ? { backgroundImage: `url(${buildAssetUrl(slide.imageUrl)})` } : undefined} />
                        <span>
                          <strong>{slide.tabLabel || slide.title || `Sekme ${index + 1}`}</strong>
                          <small>{slide.enabled === false ? 'Pasif' : 'Aktif'} · Sıra {slide.sortOrder || (index + 1) * 10}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="admin-home-button-row">
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={addHeroSlide}>
                      Sekme Ekle
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => removeHeroSlide(selectedHeroSlide.key)}
                      disabled={(form.heroSlides || []).length <= 1}
                    >
                      Seçili Sekmeyi Sil
                    </button>
                  </div>
                </div>

                <div className="admin-home-edit-block">
                  <div className="admin-home-edit-label">
                    <strong>Seçili Sekmeyi Düzenle</strong>
                    <span>Görsel, metin, CTA ve sıralama sadece seçili sekme için güncellenir.</span>
                  </div>
                  <label className="admin-home-field">
                    <span>Sekme Adı</span>
                    <input
                      className="admin-input"
                      value={selectedHeroSlide.tabLabel || ''}
                      onChange={(e) => updateHero('tabLabel', e.target.value)}
                    />
                  </label>
                  <div className="admin-form-grid">
                    <label>
                      <span>Aktif</span>
                      <select className="admin-input" value={selectedHeroSlide.enabled === false ? '0' : '1'} onChange={(e) => updateHero('enabled', e.target.value === '1')}>
                        <option value="1">Aktif</option>
                        <option value="0">Pasif</option>
                      </select>
                    </label>
                    <label>
                      <span>Sıra</span>
                      <input className="admin-input" type="number" value={selectedHeroSlide.sortOrder || 10} onChange={(e) => updateHero('sortOrder', Number(e.target.value))} />
                    </label>
                  </div>
                </div>

                <div className="admin-home-edit-block">
                  <div className="admin-home-edit-label">
                    <strong>Hero Görseli</strong>
                    <span>Ana banner görseli (önerilen boyut: 1200x600)</span>
                  </div>
                  <div
                    className={`admin-home-hero-upload-preview ${heroPreviewImage ? 'has-image' : ''}`}
                    style={heroPreviewImage ? { backgroundImage: `url(${heroPreviewImage})` } : undefined}
                  >
                    {!heroPreviewImage ? <span>Hero görseli önizlemesi</span> : null}
                  </div>
                  <div className="admin-home-button-row">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => heroFileInputRef.current?.click()}
                      disabled={uploadingKey === 'hero'}
                    >
                      {uploadingKey === 'hero' ? 'Yükleniyor...' : 'Görseli Şablona Uyarla'}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={removeHeroImage}
                      disabled={uploadingKey === 'hero'}
                    >
                      Kaldır
                    </button>
                    <input
                      ref={heroFileInputRef}
                      className="admin-home-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingKey === 'hero'}
                      onChange={(e) => {
                        handleHeroImageSelect(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {uploadStage ? <div className="admin-muted">{uploadStage}</div> : null}
                </div>

                <label className="admin-home-field">
                  <span>Başlık</span>
                  <input
                    className="admin-input"
                    maxLength={HERO_TITLE_LIMIT}
                    value={selectedHeroSlide.title || ''}
                    onChange={(e) => updateHeroTitle(e.target.value)}
                  />
                  <small>{String(selectedHeroSlide.title || '').length} / {HERO_TITLE_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Alt Başlık</span>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    maxLength={HERO_SUBTITLE_LIMIT}
                    value={selectedHeroSlide.subtitle || ''}
                    onChange={(e) => updateHeroSubtitle(e.target.value)}
                  />
                  <small>{String(selectedHeroSlide.subtitle || '').length} / {HERO_SUBTITLE_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Buton Yazısı</span>
                  <input
                    className="admin-input"
                    maxLength={HERO_CTA_LIMIT}
                    value={selectedHeroSlide.ctaLabel || ''}
                    onChange={(e) => updateHero('ctaLabel', e.target.value)}
                  />
                  <small>{String(selectedHeroSlide.ctaLabel || '').length} / {HERO_CTA_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Buton Yönlendirme</span>
                  <input
                    className="admin-input"
                    placeholder="/create"
                    value={selectedHeroSlide.ctaPath || ''}
                    onChange={(e) => updateHero('ctaPath', e.target.value)}
                  />
                  <small>Örn: /create</small>
                </label>

                <button type="button" className="admin-btn admin-home-save-button" onClick={save} disabled={loading || saving || Boolean(uploadingKey)}>
                  {saving ? 'Kaydediliyor…' : uploadingKey ? 'Görsel yükleniyor…' : 'Kaydet ve Yayınla'}
                </button>
                <p className="admin-home-publish-note">Değişiklikler kaydedildikten sonra uygulama ana sayfasında yayına alınır.</p>
                {publicContentCheck ? (
                  <div className={`admin-home-sync-check ${publicContentCheck.ok ? 'is-ok' : 'is-warning'}`}>
                    <strong>Yansıma Kontrolü</strong>
                    <span>Son kaydedilen başlık: {publicContentCheck.savedTitle || '-'}</span>
                    <span>Public content başlığı: {publicContentCheck.publicTitle || '-'}</span>
                    <span>Kaydedilen görsel URL: {publicContentCheck.savedImageUrl || '-'}</span>
                    <span>Public görsel URL: {publicContentCheck.publicImageUrl || '-'}</span>
                    <span>Public tam görsel URL: {publicContentCheck.publicImageFullUrl || '-'}</span>
                    <span>Provider: {publicContentCheck.provider || '-'}</span>
                    <span>Hero sekme sayısı: {publicContentCheck.publicHeroSlideCount ?? 0}</span>
                    <span>Aktif hero sekmesi: {publicContentCheck.publicActiveHeroSlideCount ?? 0}</span>
                    <span>İlk aktif slide: {publicContentCheck.firstActiveSlideTitle || '-'}</span>
                    <span>İlk aktif slide görsel URL: {publicContentCheck.firstActiveSlideImageUrl || '-'}</span>
                    <span>Kategori kısa yolu: {publicContentCheck.publicCategoryCount}</span>
                    <small>Kontrol zamanı: {publicContentCheck.checkedAt}</small>
                    <a href={APP_HOME_PREVIEW_HREF} target="_blank" rel="noreferrer">
                      App’te Aç
                    </a>
                  </div>
                ) : null}

              </aside>

              <aside className="admin-home-live-preview-panel">
                <div className="admin-home-live-preview-header">
                  <div>
                    <h3>Canlı Mobil Önizleme</h3>
                    <p>Uygulama ana sayfası gerçek mobil görünümle burada gösterilir.</p>
                  </div>
                  <div className="admin-home-live-preview-actions">
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={refreshLivePreview}>
                      Önizlemeyi Yenile
                    </button>
                    <a className="admin-btn admin-btn-secondary" href={APP_HOME_PREVIEW_HREF} target="_blank" rel="noreferrer">
                      App’te Aç
                    </a>
                  </div>
                </div>
                <div className="admin-home-live-preview-stage">
                  <div className="admin-home-live-device-frame">
                    {livePreviewLoading ? (
                      <div className="admin-home-live-frame-status">Canlı önizleme yükleniyor...</div>
                    ) : null}
                    {livePreviewError ? (
                      <div className="admin-home-live-frame-error">
                        Canlı önizleme yüklenemedi. App’i yeni sekmede açarak kontrol edin.
                      </div>
                    ) : null}
                    <iframe
                      key={previewReloadKey}
                      title="Talepet canlı mobil önizleme"
                      src={livePreviewSrc}
                      className="admin-home-live-iframe"
                      loading="lazy"
                      onLoad={() => setLivePreviewLoading(false)}
                      onError={() => {
                        setLivePreviewLoading(false);
                        setLivePreviewError(true);
                      }}
                    />
                  </div>
                </div>
              </aside>
            </div>

            <details className="admin-home-advanced">
              <summary>
                <span>Gelişmiş Ayarlar</span>
                <small>(isteğe bağlı) Kategori kısa yolları, bölümler ve tema ayarlarını düzenleyin.</small>
              </summary>
              <div className="admin-home-advanced-body">
                <div className="admin-card admin-plan-card">
                  <div className="admin-card-title">Eski başlık alanı</div>
                  <div className="admin-form-grid">
                    <label>
                      <span>Başlık</span>
                      <input className="admin-input" value={form.heroTitle || ''} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
                    </label>
                    <label>
                      <span>Alt başlık</span>
                      <textarea className="admin-textarea" rows={3} value={form.heroSubtitle || ''} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
                    </label>
                    <label>
                      <span>Hero aktif</span>
                      <select className="admin-input" value={form.heroBanner.enabled ? '1' : '0'} onChange={(e) => updateHero('enabled', e.target.value === '1')}>
                        <option value="1">Aktif</option>
                        <option value="0">Pasif</option>
                      </select>
                    </label>
                    <label>
                      <span>Hero overlay</span>
                      <select className="admin-input" value={form.heroBanner.overlayEnabled ? '1' : '0'} onChange={(e) => updateHero('overlayEnabled', e.target.value === '1')}>
                        <option value="1">Aktif</option>
                        <option value="0">Pasif</option>
                      </select>
                    </label>
                    <label>
                      <span>Hero görsel URL</span>
                      <input className="admin-input" value={form.heroBanner.imageUrl || ''} onChange={(e) => updateHero('imageUrl', e.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="admin-card admin-plan-card">
                  <div className="admin-card-title">Kategori Kısa Yolları</div>
                  <div className="admin-muted" style={{ marginBottom: 12 }}>
                    Kullanıcının ana sayfada hızlı filtre seçmesini sağlar.
                  </div>
                  <div className="admin-repeat-list">
                  {(form.quickCategories || []).map((item, index) => (
                    <div className="admin-repeat-item" key={item.key || index}>
                      <div className="admin-repeat-header">
                        <strong>{item.label || `Kısa yol ${index + 1}`}</strong>
                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => removeQuickCategory(index)}>
                          Sil
                        </button>
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          <span>Label</span>
                          <input className="admin-input" value={item.label || ''} onChange={(e) => updateQuickCategory(index, 'label', e.target.value)} />
                        </label>
                        <label>
                          <span>Segment</span>
                          <select className="admin-input" value={item.segment || ''} onChange={(e) => updateQuickCategory(index, 'segment', e.target.value)}>
                            {SEGMENTS.map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Category ID</span>
                          <input className="admin-input" value={item.categoryId || ''} onChange={(e) => updateQuickCategory(index, 'categoryId', e.target.value)} />
                        </label>
                        <label>
                          <span>Arka plan</span>
                          <input className="admin-input" type="color" value={item.backgroundColor || '#F8F6F2'} onChange={(e) => updateQuickCategory(index, 'backgroundColor', e.target.value)} />
                        </label>
                        <label>
                          <span>Aktif</span>
                          <select className="admin-input" value={item.enabled === false ? '0' : '1'} onChange={(e) => updateQuickCategory(index, 'enabled', e.target.value === '1')}>
                            <option value="1">Aktif</option>
                            <option value="0">Pasif</option>
                          </select>
                        </label>
                        <label>
                          <span>Sıra</span>
                          <input className="admin-input" type="number" value={item.sortOrder || 0} onChange={(e) => updateQuickCategory(index, 'sortOrder', Number(e.target.value))} />
                        </label>
                        <label>
                          <span>Icon URL</span>
                          <input className="admin-input" value={item.iconUrl || ''} onChange={(e) => updateQuickCategory(index, 'iconUrl', e.target.value)} />
                        </label>
                        <label>
                          <span>Icon upload</span>
                          <input
                            className="admin-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={uploadingKey === `quickCategory-${index}`}
                            onChange={(e) => {
                              uploadAsset(e.target.files?.[0], 'quickCategory', index);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={addQuickCategory}>
                  Kısa Yol Ekle
                </button>
                </div>

                <div className="admin-card admin-plan-card">
                  <div className="admin-card-title">Ana Sayfa Bölümleri</div>
                  <div className="admin-muted" style={{ marginBottom: 12 }}>
                    Liste başlıklarını ve hangi talep kaynaklarının öne çıkacağını belirler.
                  </div>
                  <div className="admin-repeat-list">
                  {(form.homeSections || []).map((item, index) => (
                    <div className="admin-repeat-item" key={item.key || index}>
                      <div className="admin-repeat-header">
                        <strong>{item.title || `Bölüm ${index + 1}`}</strong>
                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => removeSection(index)}>
                          Sil
                        </button>
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          <span>Başlık</span>
                          <input className="admin-input" value={item.title || ''} onChange={(e) => updateSection(index, 'title', e.target.value)} />
                        </label>
                        <label>
                          <span>Kaynak</span>
                          <select className="admin-input" value={item.source || 'latest'} onChange={(e) => updateSection(index, 'source', e.target.value)}>
                            {SECTION_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Alt başlık</span>
                          <input className="admin-input" value={item.subtitle || ''} onChange={(e) => updateSection(index, 'subtitle', e.target.value)} />
                        </label>
                        <label>
                          <span>Aktif</span>
                          <select className="admin-input" value={item.enabled === false ? '0' : '1'} onChange={(e) => updateSection(index, 'enabled', e.target.value === '1')}>
                            <option value="1">Aktif</option>
                            <option value="0">Pasif</option>
                          </select>
                        </label>
                        <label>
                          <span>Sıra</span>
                          <input className="admin-input" type="number" value={item.sortOrder || 0} onChange={(e) => updateSection(index, 'sortOrder', Number(e.target.value))} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={addSection}>
                  Bölüm Ekle
                </button>
                </div>

                <div className="admin-card admin-plan-card">
                  <div className="admin-card-title">Görsel Tema</div>
                  <div className="admin-muted" style={{ marginBottom: 12 }}>
                    Kart radius, arka plan ve yumuşak görünüm ayarlarıdır.
                  </div>
                  <div className="admin-form-grid">
                  <label>
                    <span>Arka plan</span>
                    <input className="admin-input" type="color" value={form.visualTheme.background || '#F5F1EA'} onChange={(e) => updateTheme('background', e.target.value)} />
                  </label>
                  <label>
                    <span>Kart radius</span>
                    <input className="admin-input" type="number" value={form.visualTheme.cardRadius || 28} onChange={(e) => updateTheme('cardRadius', Number(e.target.value))} />
                  </label>
                  <label>
                    <span>Soft kartlar</span>
                    <select className="admin-input" value={form.visualTheme.useSoftCards ? '1' : '0'} onChange={(e) => updateTheme('useSoftCards', e.target.value === '1')}>
                      <option value="1">Aktif</option>
                      <option value="0">Pasif</option>
                    </select>
                  </label>
                  </div>
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
