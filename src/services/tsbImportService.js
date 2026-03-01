import { createRequire } from 'module';
import CarBrand from '../../models/CarBrand.js';
import CarModel from '../../models/CarModel.js';
import CarVariant from '../../models/CarVariant.js';

const require = createRequire(import.meta.url);

const normalizeName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const buildSlug = (value) =>
  normalizeName(value)
    .toLowerCase()
    .replace(/[ı]/g, 'i')
    .replace(/[ğ]/g, 'g')
    .replace(/[ş]/g, 's')
    .replace(/[ç]/g, 'c')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const loadXlsx = () => {
  try {
    return require('xlsx');
  } catch (error) {
    const err = new Error('xlsx module is not installed. Run: npm i xlsx');
    err.cause = error;
    throw err;
  }
};

const loadCsvParser = () => {
  try {
    return require('csv-parse/sync');
  } catch (error) {
    const err = new Error('csv-parse module is not installed. Run: npm i csv-parse');
    err.cause = error;
    throw err;
  }
};

const toNumber = (value) => {
  if (value == null) return null;
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return null;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : null;
};

const getField = (row, keys) => {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);
  const map = new Map(entries.map(([key, value]) => [String(key).toLowerCase(), value]));
  for (const key of keys) {
    const value = map.get(key);
    if (value != null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

export const parseXlsx = (buffer) => {
  const xlsx = loadXlsx();
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const rows = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    rows.push(...data);
  });
  return rows;
};

export const parseCsv = (buffer) => {
  const { parse: parseCsvSync } = loadCsvParser();
  const content = buffer.toString('utf8');
  return parseCsvSync(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
};

export const normalizeRow = (row) => {
  const brandName = normalizeName(
    getField(row, ['marka', 'brand', 'marka adı', 'marka adi', 'marka_adi'])
  );
  const modelName = normalizeName(
    getField(row, ['model', 'model adı', 'model adi', 'model_adi'])
  );
  const variantName = normalizeName(
    getField(row, [
      'tip',
      'versiyon',
      'tip/versiyon',
      'arac tipi',
      'araç tipi',
      'tip adı',
      'tip adi',
      'model tipi'
    ])
  );
  const vehicleCode = normalizeName(
    getField(row, ['araç kodu', 'arac kodu', 'vehiclecode', 'kod', 'tsb kodu', 'vehicle_code'])
  );
  const yearRaw = getField(row, ['yıl', 'yil', 'model yılı', 'model yil', 'year']);
  const year = yearRaw ? Number(String(yearRaw).replace(/[^\d]/g, '')) : null;
  const kaskoValue = toNumber(
    getField(row, ['kasko', 'kasko değeri', 'kasko degeri', 'değer', 'deger', 'kasko değeri (tl)'])
  );

  if (!brandName || !modelName) {
    return null;
  }

  return {
    brandName,
    modelName,
    variantName,
    vehicleCode,
    year: Number.isFinite(year) ? year : null,
    kaskoValue
  };
};

export const importTsbRows = async (rows) => {
  const brandCache = new Map();
  const modelCache = new Map();
  let brandsUpserted = 0;
  let modelsUpserted = 0;
  let variantsUpserted = 0;
  let rowsProcessed = 0;

  const variantOps = [];

  for (const row of rows) {
    const normalized = normalizeRow(row);
    if (!normalized) {
      continue;
    }
    rowsProcessed += 1;
    const brandSlug = buildSlug(normalized.brandName);
    let brandId = brandCache.get(brandSlug);
    if (!brandId) {
      const existingBrand = await CarBrand.findOne({ slug: brandSlug }).select('_id');
      if (existingBrand) {
        brandId = existingBrand._id;
      } else {
        const createdBrand = await CarBrand.create({
          name: normalized.brandName,
          slug: brandSlug
        });
        brandId = createdBrand._id;
        brandsUpserted += 1;
      }
      brandCache.set(brandSlug, brandId);
    }

    const modelSlug = buildSlug(normalized.modelName);
    const modelKey = `${brandId}:${modelSlug}`;
    let modelId = modelCache.get(modelKey);
    if (!modelId) {
      const existingModel = await CarModel.findOne({ brandId, slug: modelSlug }).select('_id');
      if (existingModel) {
        modelId = existingModel._id;
      } else {
        const createdModel = await CarModel.create({
          brandId,
          name: normalized.modelName,
          slug: modelSlug
        });
        modelId = createdModel._id;
        modelsUpserted += 1;
      }
      modelCache.set(modelKey, modelId);
    }

    const variantFilter = normalized.vehicleCode
      ? { vehicleCode: normalized.vehicleCode }
      : {
          brandId,
          modelId,
          year: normalized.year || null,
          variantName: normalized.variantName || ''
        };

    variantOps.push({
      updateOne: {
        filter: variantFilter,
        update: {
          $set: {
            brandId,
            modelId,
            year: normalized.year || null,
            vehicleCode: normalized.vehicleCode || undefined,
            variantName: normalized.variantName || '',
            kaskoValue: normalized.kaskoValue || undefined,
            raw: row
          }
        },
        upsert: true
      }
    });

    if (variantOps.length >= 500) {
      const result = await CarVariant.bulkWrite(variantOps, { ordered: false });
      variantsUpserted += result.upsertedCount || 0;
      variantOps.length = 0;
    }
  }

  if (variantOps.length) {
    const result = await CarVariant.bulkWrite(variantOps, { ordered: false });
    variantsUpserted += result.upsertedCount || 0;
  }

  return {
    brandsUpserted,
    modelsUpserted,
    variantsUpserted,
    rowsProcessed
  };
};
