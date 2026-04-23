import 'dotenv/config';
import mongoose from 'mongoose';

const targetEmail = String(process.argv[2] || '')
  .trim()
  .toLowerCase();

const formatSnapshot = (doc) => ({
  email: doc?.email || null,
  role: doc?.role || null,
  isAdmin: doc?.isAdmin === true,
  roles: Array.isArray(doc?.roles) ? doc.roles : []
});

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI env zorunludur.');
    process.exit(1);
  }

  if (!targetEmail) {
    console.error('Kullanim: node scripts/promoteAdmin.mjs admin@talepet.net.tr');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const users = mongoose.connection.collection('users');
  const before = await users.findOne({ email: targetEmail });

  if (!before) {
    console.error(`Kullanici bulunamadi: ${targetEmail}`);
    process.exit(1);
  }

  await users.updateOne(
    { email: targetEmail },
    {
      $set: {
        role: 'admin',
        isAdmin: true,
        roles: ['admin']
      }
    }
  );

  const after = await users.findOne({ email: targetEmail });

  console.log('Before:', JSON.stringify(formatSnapshot(before)));
  console.log('After:', JSON.stringify(formatSnapshot(after)));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('ADMIN PROMOTE ERROR:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // ignore disconnect errors
  }
  process.exit(1);
});
