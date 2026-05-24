import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const DEFAULT_ADMIN_EMAIL = 'admin@talepet.net.tr';
const ALLOWED_ROLES = new Set(['admin', 'moderator']);

const args = process.argv.slice(2);
const targetEmail = String(args.find((arg) => !arg.startsWith('--')) || process.env.ADMIN_RESET_EMAIL || DEFAULT_ADMIN_EMAIL)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '');
const confirmed = args.includes('--confirm') || process.env.ADMIN_RESET_CONFIRM === 'true';

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const randomPart = Array.from(crypto.randomBytes(20), (byte) => alphabet[byte % alphabet.length]).join('');
  return `Tp-${randomPart}!7`;
};

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI env zorunludur.');
    process.exit(1);
  }

  if (!targetEmail) {
    console.error('Kullanim: node scripts/resetAdminPassword.mjs admin@talepet.net.tr --confirm');
    process.exit(1);
  }

  if (!confirmed) {
    console.error('Guvenlik icin --confirm zorunludur.');
    console.error(`Ornek: node scripts/resetAdminPassword.mjs ${targetEmail} --confirm`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ email: targetEmail }).select('+password');
  if (!admin) {
    console.error(`Admin kullanicisi bulunamadi: ${targetEmail}`);
    process.exitCode = 1;
    return;
  }

  if (!ALLOWED_ROLES.has(admin.role)) {
    console.error(`Hedef kullanici admin/moderator degil: ${targetEmail} (role=${admin.role || 'yok'})`);
    process.exitCode = 1;
    return;
  }

  if (admin.isDeleted || admin.isActive === false) {
    console.error(`Hedef admin aktif degil: ${targetEmail}`);
    process.exitCode = 1;
    return;
  }

  const temporaryPassword = process.env.ADMIN_RESET_PASSWORD || generatePassword();
  if (temporaryPassword.length < 16) {
    console.error('ADMIN_RESET_PASSWORD en az 16 karakter olmalidir.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await User.updateOne({ _id: admin._id }, { $set: { password: passwordHash } });

  const auditLog = await AdminAuditLog.create({
    adminId: admin._id,
    role: admin.role,
    action: 'admin_password_reset',
    ip: 'script:resetAdminPassword',
    userAgent: 'node scripts/resetAdminPassword.mjs',
    meta: {
      targetEmail: maskEmail(admin.email),
      resetBy: 'local-script',
      passwordGeneratedByScript: !process.env.ADMIN_RESET_PASSWORD,
      forceChangeRecommended: true
    }
  });

  console.log('Admin password reset tamamlandi.');
  console.log(`Email: ${admin.email}`);
  console.log(`Role: ${admin.role}`);
  console.log(`AuditLogId: ${auditLog._id}`);
  console.log(`TemporaryPassword: ${temporaryPassword}`);
  console.log('Ilk giristen sonra Admin > Sifre Degistir ekranindan kalici sifre belirleyin.');
};

run()
  .catch((error) => {
    console.error('ADMIN PASSWORD RESET ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore disconnect errors
    }
  });
