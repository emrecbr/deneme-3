export const PRODUCT_SCHEMAS = [
  {
    key: 'vehicle_part',
    match: /araç parça|arac parca|otomotiv|araba/i,
    requireBrandModel: true,
    fields: [
      { key: 'year', label: 'Yıl', type: 'number', required: true },
      { key: 'engine', label: 'Motor', type: 'text', required: true },
      { key: 'partCode', label: 'Parça Kodu', type: 'text', required: false },
      { key: 'oemNo', label: 'OEM No', type: 'text', required: false }
    ]
  },
  {
    key: 'electronics',
    match: /elektronik|telefon|bilgisayar|tablet|cihaz/i,
    requireBrandModel: true,
    fields: [
      { key: 'warranty', label: 'Garanti İster misin?', type: 'select', required: true, options: ['Evet', 'Hayır'] },
      { key: 'color', label: 'Renk', type: 'text', required: false },
      { key: 'specs', label: 'Teknik Özellik', type: 'textarea', required: false }
    ]
  },
  {
    key: 'construction',
    match: /inşaat|insaat|yapı|yapi|malzeme/i,
    requireBrandModel: false,
    fields: [
      { key: 'dimension', label: 'Ölçü', type: 'text', required: true },
      { key: 'material', label: 'Malzeme', type: 'text', required: true },
      { key: 'meter', label: 'Metraj', type: 'number', required: true },
      { key: 'deliveryDate', label: 'Teslim Tarihi', type: 'date', required: true }
    ]
  }
];

export const isGeneralCategory = (label) => /genel|diger|diğer/i.test(String(label || ''));

export const getProductSchema = (label) => {
  const text = String(label || '');
  if (!text.trim()) return null;
  return PRODUCT_SCHEMAS.find((schema) => schema.match.test(text)) || null;
};
