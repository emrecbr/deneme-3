import mongoose from 'mongoose';

const sanitizeMongoUri = (uri) => {
  if (!uri) return { host: 'unknown', dbName: 'unknown', masked: '' };
  try {
    const sanitized = uri.replace(/\/\/(.*)@/, '//***:***@');
    const url = new URL(sanitized);
    const dbName = url.pathname?.replace('/', '') || 'admin';
    return { host: url.host, dbName, masked: sanitized };
  } catch (_err) {
    return { host: 'unknown', dbName: 'unknown', masked: 'invalid-uri' };
  }
};

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MongoDB bağlantı hatası: MONGODB_URI env yok');
      process.exit(1);
    }
    const { host, dbName } = sanitizeMongoUri(mongoUri);
    console.log(`MongoDB hedef: ${host}/${dbName}`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB bağlandı');

    mongoose.connection.once('open', async () => {
      try {
        await mongoose.connection.db.collection('rfqs').createIndex({ location: '2dsphere' });
        console.log('2dsphere index garanti oluşturuldu');
      } catch (indexError) {
        console.error('2dsphere index oluşturma hatası:', indexError);
      }
    });
    return true;
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error.message);
    process.exit(1);
  }
};
