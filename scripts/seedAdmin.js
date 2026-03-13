import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'admin@talepet.net.tr';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

const run = async () => {
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_SEED_PASSWORD env is required to seed admin user.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
    }
    const hasPassword = Boolean(existing.password);
    const matches = hasPassword ? await bcrypt.compare(ADMIN_PASSWORD, existing.password) : false;
    if (!matches) {
      existing.password = ADMIN_PASSWORD;
    }
    await existing.save();
    console.log(`Admin user already exists: ${ADMIN_EMAIL} (updated if needed)`);
    process.exit(0);
  }

  await User.create({
    name: 'Talepet Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    emailVerified: true,
    role: 'admin'
  });

  console.log(`Admin user seeded: ${ADMIN_EMAIL}`);
  process.exit(0);
};

run().catch((error) => {
  console.error('ADMIN SEED ERROR:', error);
  process.exit(1);
});
