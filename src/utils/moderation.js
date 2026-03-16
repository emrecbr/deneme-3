import crypto from 'crypto';
import ModerationRule from '../../models/ModerationRule.js';
import ModerationAttempt from '../../models/ModerationAttempt.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';
import AppSetting from '../../models/AppSetting.js';

const TURKISH_MAP = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u'
};

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b'
};

const MODERATION_DEFAULTS = {
  phoneFilterEnabled: true,
  linkFilterEnabled: true,
  obfuscationEnabled: true,
  repeatFilterEnabled: true,
  reviewThreshold: 60,
  blockThreshold: 100,
  repeatWindowHours: 24,
  repeatLimit: 2,
  riskWeights: {
    heavyProfanity: 100,
    phone: 70,
    link: 70,
    social: 40,
    obfuscation: 20,
    repeat: 40
  }
};

const getModerationSettings = async () => {
  const doc = await AppSetting.findOne({ key: 'moderation_settings' }).lean();
  return { ...MODERATION_DEFAULTS, ...(doc?.value || {}) };
};

const normalizeBasic = (value = '') => {
  let text = String(value || '').toLowerCase();
  text = text.replace(/[çğıöşü]/g, (match) => TURKISH_MAP[match] || match);
  text = text.replace(/[0134578]/g, (match) => LEET_MAP[match] || match);
  text = text.replace(/[\u0300-\u036f]/g, '');
  return text;
};

export const normalizeText = (value = '') => {
  const basic = normalizeBasic(value);
  const collapsed = basic.replace(/(.)\1{2,}/g, '$1$1');
  const spaced = collapsed.replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
  const compact = spaced.replace(/\s+/g, '');
  return { spaced, compact };
};

const buildRuleToken = (rule) => {
  const normalized = normalizeText(rule.term || '');
  return {
    normalizedCompact: rule.normalizedTerm || normalized.compact,
    normalizedSpaced: normalized.spaced
  };
};

const detectHeuristics = (rawText, settings) => {
  const matches = [];
  if (settings?.linkFilterEnabled) {
    const linkMatches = String(rawText || '').match(/https?:\/\/|www\./gi) || [];
    if (linkMatches.length >= 2) {
      matches.push({
        id: 'heuristic_links',
        term: 'link_spam',
        category: 'spam',
        severity: 'warn',
        matchType: 'heuristic'
      });
    }
  }
  if (settings?.phoneFilterEnabled) {
    const phoneMatches = String(rawText || '').match(/(\+?\d[\d\s().-]{8,}\d)/g) || [];
    if (phoneMatches.length >= 2) {
      matches.push({
        id: 'heuristic_phone',
        term: 'phone_spam',
        category: 'spam',
        severity: 'warn',
        matchType: 'heuristic'
      });
    }
  }
  return matches;
};

export const checkModeration = async ({ userId, contentType, title, description, sourceRoute, sourceId }) => {
  const rawTitle = String(title || '');
  const rawDescription = String(description || '');
  const rawText = `${rawTitle} ${rawDescription}`.trim();
  const normalized = normalizeText(rawText);
  const settings = await getModerationSettings();

  const rules = await ModerationRule.find({ isActive: true }).lean();
  const matchedRules = [];
  const matchedSignals = [];
  let riskScore = 0;

  rules.forEach((rule) => {
    if (!rule.term) return;
    const { normalizedCompact, normalizedSpaced } = buildRuleToken(rule);
    const matchType = rule.matchType || 'contains';

    if (matchType === 'regex') {
      try {
        const regex = new RegExp(rule.term, 'i');
        if (regex.test(rawText)) {
          matchedRules.push({
            id: rule._id,
            term: rule.term,
            category: rule.category,
            severity: rule.severity,
            matchType: rule.matchType,
            riskScoreWeight: rule.riskScoreWeight || 0
          });
        }
      } catch (_error) {
        // ignore invalid regex
      }
      return;
    }

    if (!normalizedCompact) return;

    if (matchType === 'exact') {
      if (normalized.compact === normalizedCompact) {
        matchedRules.push({
          id: rule._id,
          term: rule.term,
          category: rule.category,
          severity: rule.severity,
          matchType: rule.matchType,
          riskScoreWeight: rule.riskScoreWeight || 0
        });
      }
      return;
    }

    if (matchType === 'phrase') {
      if (normalized.spaced.includes(normalizedSpaced)) {
        matchedRules.push({
          id: rule._id,
          term: rule.term,
          category: rule.category,
          severity: rule.severity,
          matchType: rule.matchType,
          riskScoreWeight: rule.riskScoreWeight || 0
        });
      }
      return;
    }

    if (normalized.compact.includes(normalizedCompact)) {
      matchedRules.push({
        id: rule._id,
        term: rule.term,
        category: rule.category,
        severity: rule.severity,
        matchType: rule.matchType,
        riskScoreWeight: rule.riskScoreWeight || 0
      });
    }
  });

  if (settings.linkFilterEnabled) {
    const linkMatches = rawText.match(/https?:\/\/|www\./gi) || [];
    const socialMatches = rawText.match(
      /(instagram|insta|ig|tiktok|telegram|whatsapp|wp|snap|facebook|fb|twitter|x\.com)/gi
    ) || [];
    if (linkMatches.length) {
      matchedSignals.push({ type: 'link', count: linkMatches.length });
      riskScore += settings.riskWeights?.link || 70;
    }
    if (socialMatches.length) {
      matchedSignals.push({ type: 'social', count: socialMatches.length });
      riskScore += settings.riskWeights?.social || 40;
    }
  }

  if (settings.phoneFilterEnabled) {
    const phoneMatches =
      rawText.match(/(\+?90\s?)?0?\s?\(?5\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g) || [];
    if (phoneMatches.length) {
      matchedSignals.push({ type: 'phone', count: phoneMatches.length });
      riskScore += settings.riskWeights?.phone || 70;
    }
  }

  if (settings.obfuscationEnabled) {
    const obfuscationHints = rawText.match(/[@$#*]/g) || [];
    if (obfuscationHints.length >= 2 || /[a-z]\s+[a-z]\s+[a-z]/i.test(rawText)) {
      matchedSignals.push({ type: 'obfuscation', count: obfuscationHints.length || 1 });
      riskScore += settings.riskWeights?.obfuscation || 20;
    }
  }

  if (settings.repeatFilterEnabled && userId) {
    const similarityKey = crypto.createHash('sha1').update(normalized.compact).digest('hex');
    const since = new Date(Date.now() - (settings.repeatWindowHours || 24) * 60 * 60 * 1000);
    const repeatedCount = await ModerationAttempt.countDocuments({
      user: userId,
      similarityKey,
      createdAt: { $gte: since }
    });
    if (repeatedCount >= (settings.repeatLimit || 2)) {
      matchedSignals.push({ type: 'repeat', count: repeatedCount });
      riskScore += settings.riskWeights?.repeat || 40;
    }
  }

  const heuristicMatches = detectHeuristics(rawText, settings);
  heuristicMatches.forEach((item) => {
    matchedRules.push(item);
  });

  if (!matchedRules.length) {
    return { blocked: false, matchedRules: [], actionTaken: 'allow', decision: 'allow', riskScore: 0 };
  }

  const hasBlock = matchedRules.some((rule) => rule.severity === 'block');
  matchedRules.forEach((rule) => {
    const base = rule.severity === 'block' ? settings.riskWeights?.heavyProfanity || 100 : 30;
    riskScore += base + (Number(rule.riskScoreWeight || 0));
  });

  const blockThreshold = Number(settings.blockThreshold || 100);
  const reviewThreshold = Number(settings.reviewThreshold || 60);
  const decision = hasBlock || riskScore >= blockThreshold ? 'block' : riskScore >= reviewThreshold ? 'review' : 'warn';
  const actionTaken = decision === 'block' ? 'blocked' : decision === 'review' ? 'review' : 'warn';
  const status = decision === 'block' ? 'blocked' : decision === 'review' ? 'under_review' : 'approved_override';
  const matchedTerms = matchedRules.map((rule) => rule.term).filter(Boolean);
  const similarityKey = crypto.createHash('sha1').update(normalized.compact).digest('hex');
  const repeatedAttemptCount = matchedSignals.find((item) => item.type === 'repeat')?.count || 0;

  await ModerationAttempt.create({
    user: userId || null,
    contentType: contentType || 'rfq',
    sourceRoute: sourceRoute || '',
    sourceId: sourceId || undefined,
    attemptedTitle: rawTitle || undefined,
    attemptedDescription: rawDescription || undefined,
    normalizedText: normalized.compact,
    matchedRules,
    matchedTerms,
    matchedSignals,
    riskScore,
    decision,
    similarityKey,
    repeatedAttemptCount,
    actionTaken,
    status
  });

  if (actionTaken === 'review') {
    try {
      await AdminAuditLog.create({
        adminId: null,
        role: 'system',
        action: 'moderation_review_required',
        meta: {
          userId,
          contentType,
          matchedTerms,
          riskScore
        }
      });
    } catch (_error) {
      // ignore audit
    }
  }

  if (actionTaken === 'blocked') {
    try {
      await AdminAuditLog.create({
        adminId: null,
        role: 'system',
        action: 'moderation_block_advanced',
        meta: {
          userId,
          contentType,
          matchedTerms
        }
      });
    } catch (_error) {
      // ignore audit
    }
  }

  if (repeatedAttemptCount >= 3) {
    try {
      await AdminAuditLog.create({
        adminId: null,
        role: 'system',
        action: 'moderation_risk_user_flag',
        meta: {
          userId,
          contentType,
          repeatedAttemptCount
        }
      });
    } catch (_error) {
      // ignore audit
    }
  }

  return { blocked: decision === 'block', matchedRules, actionTaken, decision, riskScore };
};
