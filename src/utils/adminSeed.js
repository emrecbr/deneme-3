import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

const normalizeEmail = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '');

export const ensureAdminSeed = async () => {
  const seedEmail = normalizeEmail(process.env.ADMIN_SEED_EMAIL || 'admin@talepet.net.tr');
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!seedPassword) {
    return;
  }
  if (process.env.NODE_ENV === 'production' && seedPassword === 'admin08') {
    console.warn('SECURITY WARNING: Default admin password is set in production. Please rotate ADMIN_SEED_PASSWORD.');
  }

  const existing = await User.findOne({ email: seedEmail }).select('+password');
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
    }
    const hasPassword = Boolean(existing.password);
    const matches = hasPassword ? await bcrypt.compare(seedPassword, existing.password) : false;
    if (!matches) {
      existing.password = seedPassword;
    }
    await existing.save();
    console.log(`Admin user ensured: ${seedEmail}`);
    return;
  }

  await User.create({
    name: 'Talepet Admin',
    email: seedEmail,
    password: seedPassword,
    emailVerified: true,
    role: 'admin'
  });
  console.log(`Admin user seeded: ${seedEmail}`);
};
