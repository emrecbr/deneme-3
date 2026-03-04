import mongoose from 'mongoose';

const sanitizeMongoUri = (uri) => {
  if (!uri) return { host: 'unknown', dbName: 'unknown', masked: '', query: '' };
  try {
    const sanitized = uri.replace(/\/\/(.*)@/, '//***:***@');
    const url = new URL(sanitized);
    const dbName = url.pathname?.replace('/', '') || 'admin';
    const query = url.search || '';
    return { host: url.host, dbName, masked: sanitized, query };
  } catch (_err) {
    return { host: 'unknown', dbName: 'unknown', masked: 'invalid-uri', query: '' };
  }
};

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MongoDB bağlantı hatası: MONGODB_URI env yok');
      throw new Error('MONGODB_URI env yok');
    }
    const { host, dbName, query, masked } = sanitizeMongoUri(mongoUri);
    console.log(`MongoDB hedef: ${host}/${dbName}${query || ''}`);
    if (masked) {
      console.log(`MongoDB URI (maskeli): ${masked}`);
    }
    if (/(\?|&)talepbul(=|&|$)/i.test(query)) {
      console.warn('MongoDB URI uyarı: "talepbul" query option gibi görünüyor. URI formatını kontrol et.');
    }
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
    throw error;
  }
};
