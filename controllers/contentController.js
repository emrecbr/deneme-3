import AppSetting from '../models/AppSetting.js';
import { DEFAULT_CONTENT_PAYLOAD } from './adminContentController.js';

const getKey = (section) => `content_${section}`;

export const getContent = async (req, res, next) => {
  try {
    const section = String(req.params.section || '').trim();
    const defaults = DEFAULT_CONTENT_PAYLOAD[section] || {};
    const doc = await AppSetting.findOne({ key: getKey(section) }).lean();
    return res.status(200).json({ success: true, data: { ...defaults, ...(doc?.value || {}) } });
  } catch (error) {
    return next(error);
  }
};
