export function normalizeListingQuotaSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const limit = Number(snapshot.maxFree);
  const remaining = Number(snapshot.remainingFree);
  const used = Number(snapshot.usedFree);
  const paidCredits = Number(snapshot.paidListingCredits);
  const windowDays = Number(snapshot.periodDays);

  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;
  const safeRemaining = Number.isFinite(remaining) ? Math.max(remaining, 0) : null;
  const derivedUsed = safeRemaining == null ? null : Math.max(safeLimit - safeRemaining, 0);
  const safeUsed = Number.isFinite(used) ? Math.max(used, 0) : derivedUsed;
  const safePaidCredits = Number.isFinite(paidCredits) ? Math.max(paidCredits, 0) : 0;
  const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 30;

  return {
    limit: safeLimit,
    remaining: safeRemaining,
    used: safeUsed,
    paidCredits: safePaidCredits,
    windowDays: safeWindowDays,
    resetAt: snapshot.windowEnd || null,
    windowStart: snapshot.windowStart || null,
    raw: snapshot
  };
}

export function isListingQuotaExhausted(snapshot) {
  if (!snapshot) {
    return false;
  }

  return Number(snapshot.remaining || 0) <= 0 && Number(snapshot.paidCredits || 0) <= 0;
}

export function formatListingQuotaResetDate(resetAt) {
  if (!resetAt) {
    return 'İlk ilanla başlar';
  }

  const parsed = new Date(resetAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'İlk ilanla başlar';
  }

  return parsed.toLocaleDateString('tr-TR');
}
