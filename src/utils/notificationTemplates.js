const templates = {
  rfq_created: ({ title } = {}) => ({
    title: 'Talebin yayında',
    body: title ? `${title} talebin yayına alındı.` : 'Talebin yayına alındı.'
  }),
  offer_received: ({ title } = {}) => ({
    title: 'Yeni teklif aldınız',
    body: 'Talebinize yeni bir teklif geldi.'
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
    title: 'Talebinizin süresi dolmak üzere',
    body: 'Talebinizin yayından kalkmasına kısa süre kaldı.'
  }),
  listing_expired: ({ title } = {}) => ({
    title: 'İlan süresi doldu',
    body: title ? `${title} ilanının süresi doldu.` : 'İlanının süresi doldu.'
  }),
  payment_success: () => ({
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  }),
  premium_activated: () => ({
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  }),
  featured_activated: () => ({
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  }),
  new_matching_rfq: ({ title, cityName, categoryName } = {}) => ({
    title: 'Yeni eşleşen ilan bulundu',
    body: 'İlan takip kuralınıza uygun yeni bir talep bulundu.'
  }),
  chat_message: ({ title, body } = {}) => ({
    title: title || 'Yeni mesaj',
    body: body || 'Yeni bir mesajınız var.'
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
  new_matching_rfq: 'listingNotifications',
  chat_message: 'messageNotifications',
  admin_test_push: 'systemNotifications'
};
