export const PREMIUM_PURCHASES_ENABLED = String(
  import.meta.env.VITE_PREMIUM_PURCHASES_ENABLED || 'false'
).trim().toLowerCase() === 'true';

export const PREMIUM_PURCHASE_DISABLED_MESSAGE =
  'Premium paket satın alma yakında aktif olacak.';
