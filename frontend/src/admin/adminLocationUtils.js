import { extractRfqCityName, extractRfqDistrictName, formatRfqLocation } from '../utils/rfqFormatters';

export const formatAdminCityName = (rfq) => extractRfqCityName(rfq) || '—';

export const formatAdminDistrictName = (rfq) => extractRfqDistrictName(rfq) || '—';

export const formatAdminLocationLabel = (rfq) => formatRfqLocation(rfq) || 'Konum belirtilmemis';
