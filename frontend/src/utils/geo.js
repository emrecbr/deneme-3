import api from '../api/axios';

export const toRadians = (value) => (Number(value) * Math.PI) / 180;

export const haversineKm = (from, to) => {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  const lat1 = Number(from.lat);
  const lng1 = Number(from.lng);
  const lat2 = Number(to.lat);
  const lng2 = Number(to.lng);
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return Number.POSITIVE_INFINITY;
  }
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

export const reverseGeocode = async ({ lat, lng }) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    const error = new Error('lat/lng missing');
    error.code = 'COORDS_MISSING';
    throw error;
  }
  const latStr = latNum.toFixed(6);
  const lngStr = lngNum.toFixed(6);
  return api.get('/location/reverse', { params: { lat: latStr, lng: lngStr } });
};
