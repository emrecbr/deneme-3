import AppSetting from '../models/AppSetting.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const DEFAULT_CONTENT = {
  home: {
    heroTitle: 'Talepet ile hızlı talep oluştur',
    heroSubtitle: 'Bulunduğun bölgede teklifleri keşfet.'
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

const logAdminAction = async (req, action, meta = {}) => {
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

export const getAdminContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT[section] || {};
    const doc = await AppSetting.findOne({ key: getKey(section) }).lean();
    return res.status(200).json({ success: true, data: { ...defaults, ...(doc?.value || {}) } });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT[section] || {};
    const nextValue = { ...defaults, ...(req.body || {}) };
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

export const DEFAULT_CONTENT_PAYLOAD = DEFAULT_CONTENT;
