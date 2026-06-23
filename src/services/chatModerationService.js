const PROFANITY_PATTERNS = [
  /\b(aptal|salak|gerizekal[ıi]|mal|serefsiz|şerefsiz)\b/i,
  /\b(küfür|hakaret)\b/i
];

const PHONE_PATTERN = /(?:\+?90|0)?\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|tr|io|co)\b)/i;
const SOCIAL_PATTERN = /(?:instagram|telegram|whatsapp|wp|t\.me|@[\w.]{3,})/i;
const PAYMENT_PATTERN = /\b(?:iban|havale|eft|papara|payfix|ödeme|odeme|kapora|depozito)\b/i;
const OFF_PLATFORM_PATTERN = /\b(?:dışarıdan|disaridan|uygulama dışında|uygulama disinda|telefonla ara|numaramı yaz|numarami yaz)\b/i;

const REASON_LABELS = {
  profanity: 'Hakaret/küfür olabilir',
  phone: 'Telefon numarası olabilir',
  link: 'Link içeriyor',
  social: 'Sosyal medya veya kullanıcı adı içeriyor',
  payment: 'Ödeme/para transferi yönlendirmesi olabilir',
  off_platform: 'Platform dışı iletişim yönlendirmesi olabilir',
  spam: 'Aşırı tekrar/spam olabilir'
};

const addReason = (items, key, score) => {
  items.push({
    key,
    label: REASON_LABELS[key] || key,
    score
  });
};

const hasRepeatedText = (text) => {
  const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  const words = normalized.split(' ');
  if (words.length < 6) return false;
  const counts = new Map();
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.values()].some((count) => count >= 5);
};

export const analyzeChatMessage = (content = '') => {
  const text = String(content || '').trim();
  const reasons = [];

  if (!text) {
    return {
      riskScore: 0,
      riskLevel: 'low',
      riskReasons: [],
      moderationStatus: 'clean'
    };
  }

  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(text))) {
    addReason(reasons, 'profanity', 35);
  }
  if (PHONE_PATTERN.test(text)) {
    addReason(reasons, 'phone', 35);
  }
  if (LINK_PATTERN.test(text)) {
    addReason(reasons, 'link', 30);
  }
  if (SOCIAL_PATTERN.test(text)) {
    addReason(reasons, 'social', 25);
  }
  if (PAYMENT_PATTERN.test(text)) {
    addReason(reasons, 'payment', 20);
  }
  if (OFF_PLATFORM_PATTERN.test(text)) {
    addReason(reasons, 'off_platform', 30);
  }
  if (hasRepeatedText(text)) {
    addReason(reasons, 'spam', 25);
  }

  const riskScore = Math.min(
    100,
    reasons.reduce((sum, item) => sum + item.score, 0)
  );
  const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 35 ? 'medium' : 'low';

  return {
    riskScore,
    riskLevel,
    riskReasons: reasons.map((item) => item.label),
    moderationStatus: riskScore >= 35 ? 'flagged' : 'clean'
  };
};
