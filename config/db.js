import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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
    return false;
  }
};
