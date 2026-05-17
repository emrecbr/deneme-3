export const PREMIUM_PURCHASES_ENABLED = String(
  import.meta.env.VITE_PREMIUM_PURCHASES_ENABLED || 'false'
)
  .trim()
  .toLowerCase() === 'true';

export const PREMIUM_PURCHASE_DISABLED_MESSAGE =
  'Premium paket satin alma yakinda aktif olacak.';

export const PAYMENT_SETUP_DISABLED_MESSAGE =
  'Guvenli odeme ve kart ekleme ozellikleri yakinda aktif olacak.';
