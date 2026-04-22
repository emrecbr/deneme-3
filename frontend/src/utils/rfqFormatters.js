const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || '';
};

const isLikelyObjectId = (value) => OBJECT_ID_PATTERN.test(normalizeText(value));

const firstReadableText = (...values) => {
  for (let index = 0; index < values.length; index += 1) {
    const text = normalizeText(values[index]);
    if (!text || isLikelyObjectId(text)) {
      continue;
    }
    return text;
  }
  return '';
};

const readStructuredName = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return firstReadableText(value);
  }
  return firstReadableText(
    value.name,
    value.label,
    value.title,
    value.cityName,
    value.districtName
  );
};

export const extractRfqCityName = (rfq) =>
  firstReadableText(
    rfq?.locationData?.cityName,
    rfq?.locationData?.city,
    rfq?.cityName,
    rfq?.reverseGeocode?.cityName,
    rfq?.reverseGeocodeSummary?.cityName,
    readStructuredName(rfq?.city)
  );

export const extractRfqDistrictName = (rfq) =>
  firstReadableText(
    rfq?.locationData?.districtName,
    rfq?.locationData?.district,
    rfq?.districtName,
    rfq?.reverseGeocode?.districtName,
    rfq?.reverseGeocodeSummary?.districtName,
    readStructuredName(rfq?.district)
  );

export const formatRfqLocation = (rfq) => {
  const directLocation = firstReadableText(
    rfq?.locationText,
    rfq?.locationLabel,
    rfq?.locationSummary,
    rfq?.reverseGeocodeSummary?.label,
    rfq?.reverseGeocodeSummary?.summary,
    rfq?.formattedAddress
  );

  if (directLocation) {
    return directLocation;
  }

  const cityName = extractRfqCityName(rfq);
  const districtName = extractRfqDistrictName(rfq);
  const locationSummary = [cityName, districtName].filter(Boolean).join(' / ');

  if (locationSummary) {
    return locationSummary;
  }

  return 'Konum belirtilmemis';
};
