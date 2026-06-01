import AppSetting from '../models/AppSetting.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const DEFAULT_CONTENT = {
  home: {
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
    quickCategories: [
      {
        key: 'goods',
        label: 'Eşya',
        segment: 'goods',
        categoryId: null,
        iconUrl: '',
        backgroundColor: '#FFF4DE',
        enabled: true,
        sortOrder: 10
      },
      {
        key: 'service',
        label: 'Hizmet',
        segment: 'service',
        categoryId: null,
        iconUrl: '',
        backgroundColor: '#EAF2FF',
        enabled: true,
        sortOrder: 20
      },
      {
        key: 'auto',
        label: 'Otomobil',
        segment: 'auto',
        categoryId: null,
        iconUrl: '',
        backgroundColor: '#EEFDF8',
        enabled: true,
        sortOrder: 30
      },
      {
        key: 'jobseeker',
        label: 'İş Arayan',
        segment: 'jobseeker',
        categoryId: null,
        iconUrl: '',
        backgroundColor: '#F3EFFF',
        enabled: true,
        sortOrder: 40
      }
    ],
    homeSections: [
      {
        key: 'featured',
        title: 'Öne çıkan talepler',
        subtitle: 'Premium ve öne çıkarılmış ilanlar öncelikli gösterilir.',
        enabled: true,
        source: 'featured',
        sortOrder: 10
      },
      {
        key: 'nearby',
        title: 'Yakındaki talepler',
        subtitle: 'Seçtiğin konuma ve filtrelere göre güncel talepler.',
        enabled: true,
        source: 'nearby',
        sortOrder: 20
      }
    ],
    visualTheme: {
      background: '#F5F1EA',
      cardRadius: 28,
      useSoftCards: true
    }
  },
  onboarding: {
    steps: [
      { title: 'Yakindaki Talepleri Kesfet', text: 'Konumuna gore canli talepleri goruntule.' },
      { title: 'Teklif Ver veya Talep Olustur', text: 'Ihtiyacini paylas ya da teklif vererek kazan.' },
      { title: 'Guvenli Mesajlasma ve Puanlama', text: 'Islem sonrasi degerlendirme ile guven olustur.' }
    ]
  },
  'ui-texts': {
    searchHint: 'Yazdıkça liste filtrelenecek.',
    emptyCityTitle: 'Şehir seçerek talepleri gör',
    emptyCityDescription: 'Şehir seçerek bulunduğun bölgedeki talepleri görebilirsin.'
  }
};

export const logAdminAction = async (req, action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action,
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta
    });
  } catch (_error) {
    // ignore audit errors
  }
};

const getKey = (section) => `content_${section}`;

const mergeContentValue = (section, ...sources) => {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    Object.assign(merged, source);
    if (section === 'home') {
      merged.heroBanner = { ...(merged.heroBanner || {}), ...(source.heroBanner || {}) };
      merged.visualTheme = { ...(merged.visualTheme || {}), ...(source.visualTheme || {}) };
    }
  }
  return merged;
};

export const getAdminContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT[section] || {};
    const doc = await AppSetting.findOne({ key: getKey(section) }).lean();
    return res.status(200).json({ success: true, data: mergeContentValue(section, defaults, doc?.value || {}) });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT[section] || {};
    const existing = await AppSetting.findOne({ key: getKey(section) }).lean();
    const nextValue = mergeContentValue(section, defaults, existing?.value || {}, req.body || {});
    const saved = await AppSetting.findOneAndUpdate(
      { key: getKey(section) },
      { key: getKey(section), value: nextValue, updatedBy: req.admin?.id || null },
      { upsert: true, new: true }
    );
    await logAdminAction(req, 'content_update', { section, value: nextValue });
    return res.status(200).json({ success: true, data: saved?.value || nextValue });
  } catch (error) {
    return next(error);
  }
};

export const uploadHomeContentAsset = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Görsel dosyası gerekli.' });
    }

    const url = `/uploads/${file.filename}`;
    const data = {
      url,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size
    };

    await logAdminAction(req, 'content_home_asset_upload', data);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const DEFAULT_CONTENT_PAYLOAD = DEFAULT_CONTENT;
