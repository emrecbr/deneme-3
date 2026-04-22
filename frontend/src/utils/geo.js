import api from '../api/axios';

export const toRadians = (value) => (Number(value) * Math.PI) / 180;

export const isValidLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
export const isValidLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

const toNumericCoordinate = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readCoordinatePair = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.coordinates)) {
    return value.coordinates;
  }
  if (Array.isArray(value?.coords)) {
    return value.coords;
  }
  return null;
};

export const normalizeGeoPointInput = (value) => {
  if (value == null) {
    return { point: null, lat: null, lng: null, error: 'missing_coordinates' };
  }

  const coordinatePair = readCoordinatePair(value);
  if (coordinatePair) {
    if (coordinatePair.length !== 2) {
      return { point: null, lat: null, lng: null, error: 'invalid_coordinate_array' };
    }

    const first = toNumericCoordinate(coordinatePair[0]);
    const second = toNumericCoordinate(coordinatePair[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return { point: null, lat: null, lng: null, error: 'invalid_coordinate_numbers' };
    }

    if (isValidLongitude(first) && isValidLatitude(second)) {
      return {
        point: { type: 'Point', coordinates: [first, second] },
        lng: first,
        lat: second,
        error: null
      };
    }

    if (isValidLatitude(first) && isValidLongitude(second)) {
      return {
        point: { type: 'Point', coordinates: [second, first] },
        lng: second,
        lat: first,
        error: null,
        normalizedFromSwap: true
      };
    }

    return { point: null, lat: null, lng: null, error: 'coordinates_out_of_range' };
  }

  const lat = toNumericCoordinate(value?.lat ?? value?.latitude);
  const lng = toNumericCoordinate(value?.lng ?? value?.lon ?? value?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { point: null, lat: null, lng: null, error: 'missing_lat_lng' };
  }
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return { point: null, lat: null, lng: null, error: 'coordinates_out_of_range' };
  }

  return {
    point: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    lat,
    lng,
    error: null
  };
};

export const getGeoPointErrorMessage = (value) => {
  const normalized = normalizeGeoPointInput(value);
  if (normalized.point) {
    return '';
  }

  switch (normalized.error) {
    case 'missing_coordinates':
    case 'missing_lat_lng':
      return 'Konum seçilmedi. Haritadan pin bırak veya mevcut konumunu kullan.';
    case 'invalid_coordinate_array':
    case 'invalid_coordinate_numbers':
      return 'Konum bilgisi bozuk görünüyor. Lütfen konumu yeniden seç.';
    case 'coordinates_out_of_range':
      return 'Konum bilgisi geçersiz. Latitude/longitude aralığını kontrol ederek tekrar seç.';
    default:
      return 'Konum bilgisi doğrulanamadı. Lütfen yeniden seç.';
  }
};

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
