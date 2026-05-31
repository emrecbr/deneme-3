import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';

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

const normalizeForm = (payload = {}) => ({
  ...defaultForm,
  ...payload,
  heroBanner: { ...defaultForm.heroBanner, ...(payload.heroBanner || {}) },
  visualTheme: { ...defaultForm.visualTheme, ...(payload.visualTheme || {}) },
  quickCategories: Array.isArray(payload.quickCategories) ? payload.quickCategories : defaultForm.quickCategories,
  homeSections: Array.isArray(payload.homeSections) ? payload.homeSections : defaultForm.homeSections
});

const buildAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

export default function AdminContentHome() {
  const heroFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState(HOME_VISUAL_PRESETS[0]?.key || '');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/content/home');
        if (!active) return;
        setForm(normalizeForm(response.data?.data || {}));
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

  const enabledQuickCategories = useMemo(
    () => [...(form.quickCategories || [])].filter((item) => item.enabled !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [form.quickCategories]
  );

  const enabledSections = useMemo(
    () => [...(form.homeSections || [])].filter((item) => item.enabled !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [form.homeSections]
  );
  const selectedPreset = useMemo(
    () => HOME_VISUAL_PRESETS.find((preset) => preset.key === selectedPresetKey) || HOME_VISUAL_PRESETS[0],
    [selectedPresetKey]
  );

  const updateHero = (key, value) => {
    setForm((prev) => ({ ...prev, heroBanner: { ...prev.heroBanner, [key]: value } }));
  };

  const updateHeroTitle = (value) => {
    setForm((prev) => ({
      ...prev,
      heroTitle: value,
      heroBanner: { ...prev.heroBanner, title: value }
    }));
  };

  const updateHeroSubtitle = (value) => {
    setForm((prev) => ({
      ...prev,
      heroSubtitle: value,
      heroBanner: { ...prev.heroBanner, subtitle: value }
    }));
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
    setForm((prev) =>
      normalizeForm({
        ...prev,
        ...preset.form,
        layoutVariant: 'premium_mobile_v1',
        heroBanner: {
          ...defaultForm.heroBanner,
          ...preset.form.heroBanner
        },
        quickCategories: (preset.form.quickCategories || []).map((item) => ({ ...item })),
        homeSections: (preset.form.homeSections || []).map((item) => ({ ...item })),
        visualTheme: {
          ...defaultForm.visualTheme,
          ...(preset.form.visualTheme || {})
        }
      })
    );
    setSelectedPresetKey(preset.key);
    setError('');
    setSuccess('Şablon forma uygulandı. Canlıya yansıtmak için Kaydet butonuna basın.');
  };

  const removeHeroImage = () => {
    updateHero('imageUrl', '');
    setSuccess('Hero görseli kaldırıldı. Canlıya yansıtmak için Kaydet butonuna basın.');
  };

  const uploadAsset = async (file, target, index = null) => {
    if (!file) return;
    setUploadingKey(index == null ? target : `${target}-${index}`);
    setError('');
    setSuccess('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      const response = await api.post('/admin/content/home/asset', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = response.data?.data?.url || '';
      if (!url) {
        throw new Error('Upload URL alınamadı.');
      }
      if (target === 'hero') {
        updateHero('imageUrl', url);
      } else if (target === 'quickCategory') {
        updateQuickCategory(index, 'iconUrl', url);
      }
      setSuccess('Görsel yüklendi. Yayına almak için Kaydet butonuna bas.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Görsel yüklenemedi.');
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
      const response = await api.patch('/admin/content/home', form);
      setForm(normalizeForm(response.data?.data || form));
      setSuccess('Ana sayfa içerikleri güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'İçerik güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel admin-home-visuals">
      <div className="admin-panel-title">Ana Sayfa Görsel Yönetimi</div>
      <div className="admin-panel-subtitle">
        Uygulama ana sayfasındaki hero banner, kategori kısa yolları ve liste bölüm başlıkları buradan yönetilir.
      </div>
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
              <a className="admin-btn admin-btn-secondary" href="/app" target="_blank" rel="noreferrer">
                Siteyi Görüntüle
              </a>
            </div>

            <div className="admin-home-builder-layout">
              <section className="admin-home-template-area" id="home-visual-presets">
                <div className="admin-home-section-heading">
                  <div>
                    <h3>Hazır Şablonlar</h3>
                    <p>Şablon seçimi canlıya otomatik yansımaz; formu doldurur ve önizlemeyi günceller.</p>
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
                      <small>Nerede kullanılır? {preset.useCase}</small>
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
                    <strong>Hero Görseli</strong>
                    <span>Ana banner görseli (önerilen boyut: 1200x600)</span>
                  </div>
                  <div
                    className={`admin-home-hero-upload-preview ${form.heroBanner.imageUrl ? 'has-image' : ''}`}
                    style={form.heroBanner.imageUrl ? { backgroundImage: `url(${buildAssetUrl(form.heroBanner.imageUrl)})` } : undefined}
                  >
                    {!form.heroBanner.imageUrl ? <span>Hero görseli önizlemesi</span> : null}
                  </div>
                  <div className="admin-home-button-row">
                    <button type="button" className="admin-btn" onClick={() => heroFileInputRef.current?.click()}>
                      Görsel Yükle
                    </button>
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={removeHeroImage}>
                      Kaldır
                    </button>
                    <input
                      ref={heroFileInputRef}
                      className="admin-home-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => uploadAsset(e.target.files?.[0], 'hero')}
                    />
                  </div>
                </div>

                <label className="admin-home-field">
                  <span>Başlık</span>
                  <input
                    className="admin-input"
                    maxLength={HERO_TITLE_LIMIT}
                    value={form.heroBanner.title || ''}
                    onChange={(e) => updateHeroTitle(e.target.value)}
                  />
                  <small>{String(form.heroBanner.title || '').length} / {HERO_TITLE_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Alt Başlık</span>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    maxLength={HERO_SUBTITLE_LIMIT}
                    value={form.heroBanner.subtitle || ''}
                    onChange={(e) => updateHeroSubtitle(e.target.value)}
                  />
                  <small>{String(form.heroBanner.subtitle || '').length} / {HERO_SUBTITLE_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Buton Yazısı</span>
                  <input
                    className="admin-input"
                    maxLength={HERO_CTA_LIMIT}
                    value={form.heroBanner.ctaLabel || ''}
                    onChange={(e) => updateHero('ctaLabel', e.target.value)}
                  />
                  <small>{String(form.heroBanner.ctaLabel || '').length} / {HERO_CTA_LIMIT}</small>
                </label>

                <label className="admin-home-field">
                  <span>Buton Yönlendirme</span>
                  <input
                    className="admin-input"
                    placeholder="/create"
                    value={form.heroBanner.ctaPath || ''}
                    onChange={(e) => updateHero('ctaPath', e.target.value)}
                  />
                  <small>Örn: /talep-olustur</small>
                </label>

                <div className="admin-home-edit-label">
                  <strong>Önizleme (Mobil)</strong>
                  <span>Form değişiklikleri bu telefon önizlemesine anlık yansır.</span>
                </div>

                <div
                  className="admin-home-live-phone"
                  style={{ background: form.visualTheme.background || '#F5F1EA' }}
                >
                  <div className="admin-home-live-top">
                    <strong>Talepet</strong>
                    <span>İstanbul</span>
                  </div>
                  <div className="admin-home-live-search">Ne arıyorsun?</div>
                  {form.heroBanner.enabled ? (
                    <div
                      className={`admin-home-live-hero ${form.heroBanner.overlayEnabled ? 'with-overlay' : ''}`}
                      style={form.heroBanner.imageUrl ? { backgroundImage: `url(${buildAssetUrl(form.heroBanner.imageUrl)})` } : undefined}
                    >
                      <div>
                        <h3>{form.heroBanner.title}</h3>
                        <p>{form.heroBanner.subtitle}</p>
                        {form.heroBanner.ctaLabel ? <span>{form.heroBanner.ctaLabel}</span> : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="admin-home-live-categories">
                    {enabledQuickCategories.slice(0, 4).map((item) => (
                      <div key={item.key || item.label} style={{ background: item.backgroundColor || '#F8F6F2' }}>
                        {item.iconUrl ? <img src={buildAssetUrl(item.iconUrl)} alt="" /> : <span>{String(item.label || '?').slice(0, 1)}</span>}
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="admin-home-live-section">
                    <strong>{enabledSections[0]?.title || 'Yakındaki Talepler'}</strong>
                    <span>{enabledSections[0]?.subtitle || 'Sana yakın güncel talepler.'}</span>
                  </div>
                  <div className="admin-home-live-rfq" style={{ borderRadius: Number(form.visualTheme.cardRadius || 28) }}>
                    <strong>Örnek talep kartı</strong>
                    <span>Konum, kategori ve teklif bilgisi burada görünür.</span>
                  </div>
                </div>

                <button type="button" className="admin-btn admin-home-save-button" onClick={save} disabled={loading || saving || Boolean(uploadingKey)}>
                  {saving ? 'Kaydediliyor…' : uploadingKey ? 'Görsel yükleniyor…' : 'Kaydet ve Yayınla'}
                </button>
                <p className="admin-home-publish-note">Değişiklikler kaydedildikten sonra uygulama ana sayfasında yayına alınır.</p>
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
                            onChange={(e) => uploadAsset(e.target.files?.[0], 'quickCategory', index)}
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
