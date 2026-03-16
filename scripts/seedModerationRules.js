import mongoose from 'mongoose';
import ModerationRule from '../models/ModerationRule.js';
import { normalizeText } from '../src/utils/moderation.js';

const SEED_RULES = [
  { term: 'küfür', category: 'profanity', severity: 'block', matchType: 'contains', riskScoreWeight: 40, source: 'tdk_seed' },
  { term: 'salak', category: 'insult', severity: 'review', matchType: 'contains', riskScoreWeight: 20, source: 'tdk_seed' },
  { term: 'aptal', category: 'insult', severity: 'review', matchType: 'contains', riskScoreWeight: 20, source: 'tdk_seed' },
  { term: 'gerizekalı', category: 'insult', severity: 'review', matchType: 'contains', riskScoreWeight: 25, source: 'tdk_seed' },
  { term: 'tecavüz', category: 'sexual', severity: 'block', matchType: 'contains', riskScoreWeight: 60, source: 'tdk_seed' },
  { term: 'pornografi', category: 'sexual', severity: 'block', matchType: 'contains', riskScoreWeight: 40, source: 'tdk_seed' },
  { term: 'fuhuş', category: 'sexual', severity: 'block', matchType: 'contains', riskScoreWeight: 40, source: 'tdk_seed' },
  { term: 'müstehcen', category: 'obscene', severity: 'block', matchType: 'contains', riskScoreWeight: 30, source: 'tdk_seed' },
  { term: 'öldür', category: 'violence', severity: 'review', matchType: 'contains', riskScoreWeight: 30, source: 'tdk_seed' },
  { term: 'vur', category: 'violence', severity: 'review', matchType: 'contains', riskScoreWeight: 20, source: 'tdk_seed' },
  { term: 'tehdit', category: 'threat', severity: 'review', matchType: 'contains', riskScoreWeight: 25, source: 'tdk_seed' },
  { term: 'hakaret', category: 'insult', severity: 'review', matchType: 'contains', riskScoreWeight: 20, source: 'tdk_seed' }
];

const connectDb = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGO_URI missing');
  }
  await mongoose.connect(uri);
};

const seedRules = async () => {
  let created = 0;
  let updated = 0;
  for (const rule of SEED_RULES) {
    const normalized = normalizeText(rule.term);
    const payload = {
      term: rule.term,
      normalizedTerm: normalized.compact,
      category: rule.category,
      severity: rule.severity,
      matchType: rule.matchType,
      riskScoreWeight: rule.riskScoreWeight || 0,
      isSeeded: true,
      source: rule.source || 'seeded',
      isActive: true,
      notes: 'TDK referanslı seed'
    };

    const existing = await ModerationRule.findOne({
      normalizedTerm: payload.normalizedTerm,
      category: payload.category,
      source: payload.source
    }).lean();
    if (!existing) {
      await ModerationRule.create(payload);
      created += 1;
    } else {
      updated += 1;
    }
  }

  return { created, updated, total: SEED_RULES.length };
};

const run = async () => {
  await connectDb();
  const result = await seedRules();
  console.log('[moderation-seed]', result);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('[moderation-seed] failed', error?.message || error);
  process.exit(1);
});
