import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import RFQ from '../models/RFQ.js';
import {
  BRAND_VALUE_PATTERNS,
  JUNK_VALUE_PATTERNS,
  LEGACY_CATEGORY_ALIASES,
  LEGACY_SEGMENT_HINTS,
  SEGMENT_INTENT_PATTERNS
} from './legacyCategoryAliases.js';

const ALLOWED_SEGMENTS = ['goods', 'service', 'auto', 'jobseeker'];
const CLASSIFICATIONS = [
  'safe_category_match',
  'safe_segment_only',
  'brand_like_value',
  'free_text_noise',
  'ambiguous_manual_review',
  'unmapped'
];

function parseArgs(argv) {
  const args = {
    auditOnly: true,
    apply: false,
    applySegmentOnly: false,
    limit: null,
    rfqId: '',
    reportFile: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      args.apply = true;
      args.auditOnly = false;
    } else if (arg === '--audit-only') {
      args.auditOnly = true;
      args.apply = false;
    } else if (arg === '--apply-segment-only') {
      args.applySegmentOnly = true;
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(argv[index + 1], 10) || null;
      index += 1;
    } else if (arg === '--rfq-id') {
      args.rfqId = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (arg === '--report-file') {
      args.reportFile = String(argv[index + 1] || '').trim();
      index += 1;
    }
  }

  return args;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ve ')
    .replace(/[^\p{L}\p{N}:]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSlug(value) {
  return normalizeText(value)
    .replace(/[:/]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function buildContextText(rfq) {
  return [
    rfq.title,
    rfq.description,
    rfq.category,
    rfq.car?.brandName,
    rfq.car?.modelName,
    rfq.car?.variantName,
    rfq.productDetails?.brand,
    rfq.productDetails?.model,
    rfq.productDetails?.name,
    rfq.productDetails?.category,
    rfq.vehicleDetails?.brand,
    rfq.vehicleDetails?.engine,
    rfq.vehicleDetails?.partCode
  ]
    .filter(Boolean)
    .map((item) => normalizeText(item))
    .join(' ');
}

function isBrandLikeValue(rawValue) {
  const raw = String(rawValue || '').trim();
  return BRAND_VALUE_PATTERNS.some((pattern) => pattern.test(raw));
}

function looksLikeNoise(rawValue) {
  const raw = String(rawValue || '').trim();
  const normalized = normalizeText(raw);
  if (!normalized) return true;
  if (LEGACY_CATEGORY_ALIASES[normalized]) return false;
  if (raw.includes(':')) return false;
  if (/\s/.test(raw)) return false;
  return JUNK_VALUE_PATTERNS.some((pattern) => pattern.test(raw));
}

function inferSegmentsFromContext(rfq) {
  const scores = Object.fromEntries(ALLOWED_SEGMENTS.map((segment) => [segment, 0]));
  const contextText = buildContextText(rfq);

  if (rfq.car?.brandName || rfq.car?.modelName || rfq.car?.variantName) {
    scores.auto += 5;
  }
  if (rfq.vehicleDetails?.brand || rfq.vehicleDetails?.engine || rfq.vehicleDetails?.partCode) {
    scores.auto += 4;
  }
  if (rfq.productDetails?.brand || rfq.productDetails?.model) {
    scores.auto += 2;
  }

  Object.entries(SEGMENT_INTENT_PATTERNS).forEach(([segment, hints]) => {
    hints.forEach((hint) => {
      if (contextText.includes(normalizeText(hint))) {
        scores[segment] += 1;
      }
    });
  });

  Object.entries(LEGACY_SEGMENT_HINTS).forEach(([segment, hints]) => {
    hints.forEach((hint) => {
      if (contextText.includes(normalizeText(hint))) {
        scores[segment] += 1;
      }
    });
  });

  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const top = ranked[0] ? { segment: ranked[0][0], score: ranked[0][1] } : { segment: '', score: 0 };
  const second = ranked[1] ? { segment: ranked[1][0], score: ranked[1][1] } : { segment: '', score: 0 };
  const strong = Boolean(top.segment) && top.score >= 2 && top.score >= second.score + 1;

  return {
    topSegment: top.segment,
    topScore: top.score,
    runnerUpSegment: second.segment,
    runnerUpScore: second.score,
    strong,
    scores
  };
}

function buildCategoryIndexes(categories) {
  const exactSlugMap = new Map();
  const normalizedSlugMap = new Map();
  const normalizedNameMap = new Map();
  const keyMap = new Map();

  categories.forEach((category) => {
    const exactSlug = String(category.slug || '').trim().toLowerCase();
    const normalizedCategorySlug = normalizeSlug(category.slug || '');
    const normalizedName = normalizeText(category.name || '');
    const key = `${String(category.segment || '').trim().toLowerCase()}:${normalizeText(category.pathName || category.name || '')}`;

    if (exactSlug) {
      const list = exactSlugMap.get(exactSlug) || [];
      list.push(category);
      exactSlugMap.set(exactSlug, list);
    }
    if (normalizedCategorySlug) {
      const list = normalizedSlugMap.get(normalizedCategorySlug) || [];
      list.push(category);
      normalizedSlugMap.set(normalizedCategorySlug, list);
    }
    if (normalizedName) {
      const list = normalizedNameMap.get(normalizedName) || [];
      list.push(category);
      normalizedNameMap.set(normalizedName, list);
    }
    keyMap.set(key, category);
  });

  return { exactSlugMap, normalizedSlugMap, normalizedNameMap, keyMap };
}

function uniqueCategories(items) {
  const map = new Map();
  items.forEach((item) => {
    map.set(String(item._id), item);
  });
  return Array.from(map.values());
}

function resolveCategoryCandidates(rawValue, indexes, segmentHint = '') {
  const original = String(rawValue || '').trim();
  const exactSlug = original.toLowerCase();
  const normalizedRawSlug = normalizeSlug(original);
  const normalizedRawName = normalizeText(original);

  const stages = [];
  const pushStage = (type, candidates) => {
    if (candidates.length) {
      stages.push({ type, candidates: uniqueCategories(candidates) });
    }
  };

  pushStage('exact_slug', indexes.exactSlugMap.get(exactSlug) || []);
  pushStage('normalized_slug', indexes.normalizedSlugMap.get(normalizedRawSlug) || []);
  pushStage('normalized_name', indexes.normalizedNameMap.get(normalizedRawName) || []);

  const aliasTargets = LEGACY_CATEGORY_ALIASES[normalizedRawName] || [];
  const aliasCandidates = aliasTargets.map((key) => indexes.keyMap.get(key)).filter(Boolean);
  pushStage('alias', aliasCandidates);

  for (const stage of stages) {
    const narrowed = segmentHint
      ? stage.candidates.filter((item) => item.segment === segmentHint)
      : stage.candidates;

    if (narrowed.length === 1) {
      return {
        status: 'matched',
        matchType: stage.type,
        category: narrowed[0],
        candidates: narrowed
      };
    }

    if (narrowed.length > 1) {
      return {
        status: 'ambiguous',
        matchType: stage.type,
        candidates: narrowed
      };
    }

    if (!segmentHint && stage.candidates.length > 1) {
      return {
        status: 'ambiguous',
        matchType: stage.type,
        candidates: stage.candidates
      };
    }
  }

  return {
    status: 'unmapped',
    matchType: '',
    candidates: []
  };
}

function classifyRecord(rfq, indexes) {
  const rawCategory = String(rfq.category || '').trim();
  const existingSegment = String(rfq.segment || '').trim().toLowerCase();
  const brandLike = isBrandLikeValue(rawCategory);
  const noiseLike = looksLikeNoise(rawCategory);
  const intent = inferSegmentsFromContext(rfq);
  const segmentHint = ALLOWED_SEGMENTS.includes(existingSegment) ? existingSegment : intent.topSegment;
  const resolution = resolveCategoryCandidates(rawCategory, indexes, segmentHint);

  if (resolution.status === 'matched') {
    return {
      classification: 'safe_category_match',
      rawCategory,
      segmentHint,
      intent,
      resolution,
      canApplyCategory: true,
      canApplySegmentOnly: !existingSegment && Boolean(resolution.category?.segment)
    };
  }

  if (resolution.status === 'ambiguous') {
    return {
      classification: 'ambiguous_manual_review',
      rawCategory,
      segmentHint,
      intent,
      resolution,
      canApplyCategory: false,
      canApplySegmentOnly: false
    };
  }

  if (brandLike) {
    return {
      classification: 'brand_like_value',
      rawCategory,
      segmentHint: intent.topSegment,
      intent,
      resolution,
      canApplyCategory: false,
      canApplySegmentOnly: !existingSegment && intent.strong
    };
  }

  if (intent.strong) {
    return {
      classification: 'safe_segment_only',
      rawCategory,
      segmentHint: intent.topSegment,
      intent,
      resolution,
      canApplyCategory: false,
      canApplySegmentOnly: !existingSegment,
      traits: {
        brandLike,
        noiseLike
      }
    };
  }

  if (noiseLike) {
    return {
      classification: 'free_text_noise',
      rawCategory,
      segmentHint: intent.topSegment,
      intent,
      resolution,
      canApplyCategory: false,
      canApplySegmentOnly: false
    };
  }

  return {
    classification: 'unmapped',
    rawCategory,
    segmentHint: intent.topSegment,
    intent,
    resolution,
    canApplyCategory: false,
    canApplySegmentOnly: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI tanimli degil.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const categoryDocs = await Category.find({ segment: { $in: ALLOWED_SEGMENTS } })
    .select('_id name slug segment parent')
    .lean();

  const categoryById = new Map(categoryDocs.map((item) => [String(item._id), item]));
  const enrichedCategories = categoryDocs.map((item) => {
    const parent = item.parent ? categoryById.get(String(item.parent)) : null;
    return {
      ...item,
      pathName: parent?.name && parent.name !== item.name ? `${parent.name} > ${item.name}` : item.name
    };
  });

  const indexes = buildCategoryIndexes(enrichedCategories);

  const query = { category: { $type: 'string' } };
  if (args.rfqId) {
    query._id = args.rfqId;
  }

  let rfqQuery = RFQ.find(query)
    .select('_id title description category segment car productDetails vehicleDetails segmentMetadata createdAt')
    .sort({ createdAt: -1 });

  if (args.limit) {
    rfqQuery = rfqQuery.limit(args.limit);
  }

  const rfqs = await rfqQuery.lean();
  const totalRfqCount = await RFQ.countDocuments();
  const legacyStringCategoryCount = await RFQ.countDocuments({ category: { $type: 'string' } });

  const repeatedLegacyValuesMap = new Map();
  const buckets = Object.fromEntries(CLASSIFICATIONS.map((name) => [name, []]));
  let updatedCount = 0;
  let categoryUpdatedCount = 0;
  let segmentOnlyUpdatedCount = 0;
  let brandLikeSegmentOnlyUpdatedCount = 0;
  let safeSegmentOnlyUpdatedCount = 0;

  for (const rfq of rfqs) {
    const rawCategory = String(rfq.category || '').trim();
    const existingSegment = String(rfq.segment || '').trim().toLowerCase();
    const classification = classifyRecord(rfq, indexes);

    const repeated = repeatedLegacyValuesMap.get(rawCategory) || {
      value: rawCategory,
      count: 0,
      segments: new Set(),
      topClassifications: new Set(),
      nearestSegmentHint: ''
    };
    repeated.count += 1;
    if (rfq.segment) repeated.segments.add(String(rfq.segment));
    repeated.topClassifications.add(classification.classification);
    if (!repeated.nearestSegmentHint && classification.segmentHint) {
      repeated.nearestSegmentHint = classification.segmentHint;
    }
    repeatedLegacyValuesMap.set(rawCategory, repeated);

    const record = {
      rfqId: String(rfq._id),
      title: rfq.title,
      rawCategory,
      classification: classification.classification,
      existingSegment,
      segmentHint: classification.segmentHint || '',
      intentTopSegment: classification.intent.topSegment || '',
      intentTopScore: classification.intent.topScore || 0,
      canApplyCategory: Boolean(classification.canApplyCategory),
      canApplySegmentOnly: Boolean(classification.canApplySegmentOnly)
    };

    if (classification.classification === 'safe_category_match') {
      record.matchType = classification.resolution.matchType;
      record.categoryId = String(classification.resolution.category._id);
      record.categoryName = classification.resolution.category.name;
      record.categorySlug = classification.resolution.category.slug;
      record.targetSegment = classification.resolution.category.segment;
    }

    if (classification.classification === 'ambiguous_manual_review') {
      record.candidates = classification.resolution.candidates.map((item) => ({
        id: String(item._id),
        name: item.name,
        slug: item.slug,
        segment: item.segment
      }));
    }

    buckets[classification.classification].push(record);

    if (!args.apply) {
      continue;
    }

    if (classification.classification === 'safe_category_match') {
      const updatePayload = {
        category: classification.resolution.category._id
      };
      if (!rfq.segment && classification.resolution.category.segment) {
        updatePayload.segment = classification.resolution.category.segment;
      }
      const result = await RFQ.updateOne(
        { _id: rfq._id, category: rawCategory },
        { $set: updatePayload }
      );
      if (result.modifiedCount > 0) {
        updatedCount += 1;
        categoryUpdatedCount += 1;
      }
      continue;
    }

    if (
      args.applySegmentOnly &&
      classification.canApplySegmentOnly &&
      (classification.classification === 'safe_segment_only' || classification.classification === 'brand_like_value')
    ) {
      const result = await RFQ.updateOne(
        { _id: rfq._id, category: rawCategory, $or: [{ segment: { $exists: false } }, { segment: null }, { segment: '' }] },
        { $set: { segment: classification.segmentHint } }
      );
      if (result.modifiedCount > 0) {
        updatedCount += 1;
        segmentOnlyUpdatedCount += 1;
        if (classification.classification === 'brand_like_value') {
          brandLikeSegmentOnlyUpdatedCount += 1;
        } else {
          safeSegmentOnlyUpdatedCount += 1;
        }
      }
    }
  }

  const repeatedLegacyValues = Array.from(repeatedLegacyValuesMap.values())
    .map((item) => ({
      value: item.value,
      count: item.count,
      segments: Array.from(item.segments),
      classifications: Array.from(item.topClassifications),
      nearestSegmentHint: item.nearestSegmentHint || ''
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'tr'));

  const report = {
    mode: args.apply ? 'apply' : 'audit-only',
    applySegmentOnly: Boolean(args.applySegmentOnly),
    totalRfqCount,
    legacyStringCategoryCount,
    scannedLegacyRecordCount: rfqs.length,
    safeCategoryMatchCount: buckets.safe_category_match.length,
    safeSegmentOnlyCount: buckets.safe_segment_only.length,
    brandLikeValueCount: buckets.brand_like_value.length,
    freeTextNoiseCount: buckets.free_text_noise.length,
    ambiguousManualReviewCount: buckets.ambiguous_manual_review.length,
    unmappedCount: buckets.unmapped.length,
    updatedCount,
    categoryUpdatedCount,
    segmentOnlyUpdatedCount,
    brandLikeSegmentOnlyUpdatedCount,
    safeSegmentOnlyUpdatedCount,
    repeatedLegacyValues,
    examples: {
      safeCategoryMatch: buckets.safe_category_match.slice(0, 10),
      safeSegmentOnly: buckets.safe_segment_only.slice(0, 10),
      brandLikeValue: buckets.brand_like_value.slice(0, 10),
      freeTextNoise: buckets.free_text_noise.slice(0, 10),
      ambiguousManualReview: buckets.ambiguous_manual_review.slice(0, 10),
      unmapped: buckets.unmapped.slice(0, 10)
    }
  };

  if (args.reportFile) {
    fs.writeFileSync(args.reportFile, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // ignore disconnect error
  }
  process.exit(1);
});
