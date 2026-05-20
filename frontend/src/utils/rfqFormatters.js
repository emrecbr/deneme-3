const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || '';
};

const isLikelyObjectId = (value) => OBJECT_ID_PATTERN.test(normalizeText(value));

const CATEGORY_LABELS = {
  'is-arayanlar': 'İş Arayanlar',
  'is arayanlar': 'İş Arayanlar',
  'iş arayanlar': 'İş Arayanlar',
  nakliye: 'Nakliye',
  temizlik: 'Temizlik',
  yazilim: 'Yazılım',
  'yazılım': 'Yazılım',
  tadilat: 'Tadilat',
  cafe: 'Cafe',
  kafe: 'Cafe',
  sanayi: 'Sanayi',
  lokanta: 'Lokanta',
  diger: 'Diğer',
  'diğer': 'Diğer'
};

const normalizeCategoryKey = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ');

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

export const formatCategoryLabel = (value, fallback = 'Kategori belirtilmedi') => {
  if (!value) return fallback;

  const raw =
    typeof value === 'object'
      ? value.name || value.title || value.label || value.slug || ''
      : value;
  const text = normalizeText(raw);
  if (!text || isLikelyObjectId(text)) return fallback;

  const normalized = normalizeCategoryKey(text);
  const hyphenated = normalized.replace(/\s+/g, '-');
  return CATEGORY_LABELS[normalized] || CATEGORY_LABELS[hyphenated] || text;
};

export const extractRfqCategoryLabels = (rfq) => {
  const category = rfq?.category;
  const parentCandidate =
    category && typeof category === 'object'
      ? category.parentName || category.parent?.name || category.parent?.title || category.parent?.label
      : '';
  const subcategoryCandidate =
    rfq?.subcategory ||
    rfq?.subCategory ||
    rfq?.subcategoryName ||
    rfq?.subCategoryName ||
    (parentCandidate ? category : null);

  const categoryLabel = parentCandidate
    ? formatCategoryLabel(parentCandidate)
    : formatCategoryLabel(category);
  const subcategoryLabel = subcategoryCandidate
    ? formatCategoryLabel(subcategoryCandidate, 'Alt kategori belirtilmedi')
    : '';

  return {
    categoryLabel,
    subcategoryLabel:
      subcategoryLabel && subcategoryLabel !== categoryLabel ? subcategoryLabel : ''
  };
};
