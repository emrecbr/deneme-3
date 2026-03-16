const templates = {
  rfq_created: ({ title } = {}) => ({
    title: 'Talebin yayında',
    body: title ? `${title} talebin yayına alındı.` : 'Talebin yayına alındı.'
  }),
  offer_received: ({ title } = {}) => ({
    title: 'Yeni teklif',
    body: title ? `${title} talebin için yeni teklif geldi.` : 'Talebin için yeni teklif geldi.'
  }),
  offer_accepted: ({ title } = {}) => ({
    title: 'Teklif kabul edildi',
    body: title ? `${title} talebindeki teklif kabul edildi.` : 'Teklif kabul edildi.'
  }),
  report_resolved: () => ({
    title: 'Sorun bildirimi güncellendi',
    body: 'Bildiriminiz sonuçlandı. Detayları profilinizden görebilirsiniz.'
  }),
  listing_expiring: ({ title } = {}) => ({
    title: 'İlan süresi bitiyor',
    body: title ? `${title} ilanının süresi yakında dolacak.` : 'İlanının süresi yakında dolacak.'
  }),
  listing_expired: ({ title } = {}) => ({
    title: 'İlan süresi doldu',
    body: title ? `${title} ilanının süresi doldu.` : 'İlanının süresi doldu.'
  }),
  payment_success: () => ({
    title: 'Ödeme başarılı',
    body: 'Ödemeniz başarıyla alındı.'
  }),
  premium_activated: () => ({
    title: 'Premium aktif',
    body: 'Premium üyeliğiniz aktif edildi.'
  }),
  featured_activated: () => ({
    title: 'Öne çıkarma aktif',
    body: 'İlanınız öne çıkarıldı.'
  }),
  admin_test_push: ({ title, body } = {}) => ({
    title: title || 'Test bildirimi',
    body: body || 'Bu bir test bildirimidir.'
  })
};

export const getNotificationTemplate = (type, payload = {}) => {
  const template = templates[type];
  if (template) return template(payload);
  return {
    title: payload?.title || 'Bildirim',
    body: payload?.body || 'Yeni bir bildiriminiz var.'
  };
};

export const notificationPreferenceMap = {
  rfq_created: 'listingNotifications',
  offer_received: 'offerNotifications',
  offer_accepted: 'offerNotifications',
  report_resolved: 'systemNotifications',
  listing_expiring: 'listingNotifications',
  listing_expired: 'listingNotifications',
  payment_success: 'paymentNotifications',
  premium_activated: 'paymentNotifications',
  featured_activated: 'paymentNotifications',
  admin_test_push: 'systemNotifications'
};
