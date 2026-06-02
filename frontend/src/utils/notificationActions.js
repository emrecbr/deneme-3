export const getNotificationId = (item) => item?.id || item?._id || '';

export const normalizeNotification = (item) => {
  const data = item?.data || item?.metadata || {};
  const id = getNotificationId(item);
  return {
    ...item,
    id,
    _id: id,
    data,
    title: item?.title || item?.message || 'Bildirim',
    body: item?.body || item?.description || data?.preview || data?.note || '',
    isRead: Boolean(item?.isRead || item?.readAt)
  };
};

export const normalizeNotifications = (items = []) =>
  Array.isArray(items) ? items.map(normalizeNotification).filter((item) => item._id || item.id) : [];

const getTypeFallbackTarget = (type) => {
  if (type === 'new_matching_rfq') return '/listing-follows';
  if (type === 'moderation_result' || type === 'moderation_update') return '/profile/requests';
  if (type === 'listing_expiring' || type === 'listing_expired') return '/profile/requests';
  if (type === 'payment_success' || type === 'payment_update') return '/profile';
  if (type === 'premium_activated' || type === 'featured_activated') return '/profile';
  return '';
};

export const resolveNotificationTarget = (item) => {
  const normalized = normalizeNotification(item);
  const data = normalized.data || {};
  const type = String(normalized.type || data.type || '').toLowerCase();

  if (normalized.targetUrl || data.targetUrl) {
    return normalized.targetUrl || data.targetUrl;
  }

  if ((normalized.targetType || data.targetType) === 'chat' && (normalized.targetId || data.targetId)) {
    return `/messages/${normalized.targetId || data.targetId}`;
  }

  if ((normalized.targetType || data.targetType) === 'rfq' && (normalized.targetId || data.targetId)) {
    return `/rfq/${normalized.targetId || data.targetId}`;
  }

  const chatId = normalized.chatId || data.chatId || data.conversationId;
  const rfqId =
    normalized.requestId ||
    normalized.rfqId ||
    normalized.demandId ||
    normalized.entityId ||
    data.requestId ||
    data.rfqId ||
    data.demandId ||
    data.entityId ||
    data.rfq;

  if ((type === 'message' || type === 'new_message') && chatId) {
    return `/messages/${chatId}`;
  }

  if ((type === 'offer_created' || type === 'offer_updated' || type === 'new_offer') && rfqId) {
    return `/rfq/${rfqId}`;
  }

  if (rfqId) {
    return `/rfq/${rfqId}`;
  }

  if (chatId) {
    return `/messages/${chatId}`;
  }

  return getTypeFallbackTarget(type);
};

export const markNotificationRead = async (api, item) => {
  const id = getNotificationId(item);
  if (!id) {
    throw new Error('Bildirim kimliği bulunamadı.');
  }
  return api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (api) => api.patch('/notifications/read-all');
