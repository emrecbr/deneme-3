import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Notification from '../models/Notification.js';

const run = async () => {
  await connectDB();

  const now = new Date();
  const result = await Notification.updateMany(
    {
      isRead: false,
      $or: [{ readAt: { $exists: false } }, { readAt: null }]
    },
    {
      $set: {
        isRead: true,
        readAt: now
      }
    }
  );

  console.log(`Marked ${result.modifiedCount || 0} existing notifications as read.`);
};

run()
  .catch((error) => {
    console.error('MARK EXISTING NOTIFICATIONS READ ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
