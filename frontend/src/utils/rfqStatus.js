export function getExpiresAtMillis(rfq) {
  if (!rfq) {
    return null;
  }

  const direct = rfq.expiresAt || rfq.deadline || rfq.expires_at;
  if (direct) {
    const ts = new Date(direct).getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  if (rfq.createdAt) {
    const created = new Date(rfq.createdAt).getTime();
    if (Number.isFinite(created)) {
      return created + 48 * 60 * 60 * 1000;
    }
  }

  if (rfq.created_at) {
    const created = new Date(rfq.created_at).getTime();
    if (Number.isFinite(created)) {
      return created + 48 * 60 * 60 * 1000;
    }
  }

  if (rfq.durationHours) {
    const base = rfq.createdAt ? new Date(rfq.createdAt).getTime() : Date.now();
    if (Number.isFinite(base)) {
      return base + Number(rfq.durationHours) * 60 * 60 * 1000;
    }
  }

  return null;
}

export function isClosedRequest(rfq) {
  if (!rfq) {
    return false;
  }
  const status = String(rfq.status || '').toLowerCase();
  return Boolean(status && ['closed', 'cancelled', 'canceled', 'selected', 'awarded', 'done', 'expired'].includes(status));
}

export function isExpiredRequest(rfq, now = Date.now()) {
  if (!rfq) {
    return false;
  }
  const expiresAt = getExpiresAtMillis(rfq);
  return Boolean(expiresAt && now > expiresAt);
}

export function isActiveRequest(rfq, now = Date.now()) {
  if (!rfq) {
    return false;
  }
  if (isClosedRequest(rfq)) {
    return false;
  }
  if (isExpiredRequest(rfq, now)) {
    return false;
  }
  return true;
}

export function getRequestStatusLabel(rfq, now = Date.now()) {
  if (isClosedRequest(rfq)) {
    return 'Kapandı';
  }
  if (isExpiredRequest(rfq, now)) {
    return 'Süresi doldu';
  }
  return 'Aktif';
}

export function formatRemainingTime(rfq, now = Date.now()) {
  const expiresAt = getExpiresAtMillis(rfq);
  if (!expiresAt) {
    return 'Belirsiz';
  }

  const diff = Math.max(0, expiresAt - now);
  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}g ${hours}s`;
  }
  if (totalHours > 0) {
    return `${totalHours}s ${minutes}d`;
  }
  return `${minutes}d`;
}
