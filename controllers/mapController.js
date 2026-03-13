import AppSetting from '../models/AppSetting.js';

const DEFAULT_MAP_SETTINGS = {
  mapViewEnabled: true,
  defaultCenter: { lat: 41.0082, lng: 28.9784 },
  defaultZoom: 11,
  minZoom: 6,
  maxZoom: 18,
  clusterEnabled: true,
  radiusCircleEnabled: true,
  controlsEnabled: true
};

export const getPublicMapSettings = async (_req, res, next) => {
  try {
    const doc = await AppSetting.findOne({ key: 'map_settings' }).lean();
    return res.status(200).json({ success: true, data: { ...DEFAULT_MAP_SETTINGS, ...(doc?.value || {}) } });
  } catch (error) {
    return next(error);
  }
};
