export const BRAND_MODEL_MAP = {
  vehicle_part: {
    brands: [
      { name: 'Bosch', models: ['ABC-100', 'XYZ-200', 'Pro-Line'] },
      { name: 'Valeo', models: ['V5', 'V7', 'Premium'] },
      { name: 'SKF', models: ['SKF-1', 'SKF-2'] }
    ]
  },
  electronics: {
    brands: [
      { name: 'Samsung', models: ['A Series', 'S Series', 'Tab'] },
      { name: 'Apple', models: ['iPhone', 'iPad', 'Mac'] },
      { name: 'Xiaomi', models: ['Redmi', 'Mi', 'Poco'] }
    ]
  },
  construction: {
    brands: [
      { name: 'Kale', models: ['Seramik', 'Armatür', 'Boya'] },
      { name: 'Eczacıbaşı', models: ['Vitra', 'Artemis'] },
      { name: 'İzocam', models: ['Cam Yünü', 'Taş Yünü'] }
    ]
  },
  default: {
    brands: [
      { name: 'Genel', models: ['Model A', 'Model B', 'Model C'] },
      { name: 'Marka 2', models: ['Seri 1', 'Seri 2'] }
    ]
  }
};

export const getBrandOptions = (schemaKey) => {
  const key = schemaKey && BRAND_MODEL_MAP[schemaKey] ? schemaKey : 'default';
  return BRAND_MODEL_MAP[key].brands;
};

export const getModelOptions = (schemaKey, brandName) => {
  if (!brandName) return [];
  const brands = getBrandOptions(schemaKey);
  const brand = brands.find((item) => item.name === brandName);
  return brand?.models || [];
};
