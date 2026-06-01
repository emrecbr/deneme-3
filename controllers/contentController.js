import AppSetting from '../models/AppSetting.js';
import { DEFAULT_CONTENT_PAYLOAD } from './adminContentController.js';

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
