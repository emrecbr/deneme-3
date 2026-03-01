import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import City from '../models/City.js';

dotenv.config();

const TURKEY_CITIES = [
  { name: 'Adana', plateCode: 1 },
  { name: 'Adıyaman', plateCode: 2 },
  { name: 'Afyonkarahisar', plateCode: 3 },
  { name: 'Ağrı', plateCode: 4 },
  { name: 'Amasya', plateCode: 5 },
  { name: 'Ankara', plateCode: 6 },
  { name: 'Antalya', plateCode: 7 },
  { name: 'Artvin', plateCode: 8 },
  { name: 'Aydın', plateCode: 9 },
  { name: 'Balıkesir', plateCode: 10 },
  { name: 'Bilecik', plateCode: 11 },
  { name: 'Bingöl', plateCode: 12 },
  { name: 'Bitlis', plateCode: 13 },
  { name: 'Bolu', plateCode: 14 },
  { name: 'Burdur', plateCode: 15 },
  { name: 'Bursa', plateCode: 16 },
  { name: 'Çanakkale', plateCode: 17 },
  { name: 'Çankırı', plateCode: 18 },
  { name: 'Çorum', plateCode: 19 },
  { name: 'Denizli', plateCode: 20 },
  { name: 'Diyarbakır', plateCode: 21 },
  { name: 'Edirne', plateCode: 22 },
  { name: 'Elazığ', plateCode: 23 },
  { name: 'Erzincan', plateCode: 24 },
  { name: 'Erzurum', plateCode: 25 },
  { name: 'Eskişehir', plateCode: 26 },
  { name: 'Gaziantep', plateCode: 27 },
  { name: 'Giresun', plateCode: 28 },
  { name: 'Gümüşhane', plateCode: 29 },
  { name: 'Hakkari', plateCode: 30 },
  { name: 'Hatay', plateCode: 31 },
  { name: 'Isparta', plateCode: 32 },
  { name: 'Mersin', plateCode: 33 },
  { name: 'İstanbul', plateCode: 34 },
  { name: 'İzmir', plateCode: 35 },
  { name: 'Kars', plateCode: 36 },
  { name: 'Kastamonu', plateCode: 37 },
  { name: 'Kayseri', plateCode: 38 },
  { name: 'Kırklareli', plateCode: 39 },
  { name: 'Kırşehir', plateCode: 40 },
  { name: 'Kocaeli', plateCode: 41 },
  { name: 'Konya', plateCode: 42 },
  { name: 'Kütahya', plateCode: 43 },
  { name: 'Malatya', plateCode: 44 },
  { name: 'Manisa', plateCode: 45 },
  { name: 'Kahramanmaraş', plateCode: 46 },
  { name: 'Mardin', plateCode: 47 },
  { name: 'Muğla', plateCode: 48 },
  { name: 'Muş', plateCode: 49 },
  { name: 'Nevşehir', plateCode: 50 },
  { name: 'Niğde', plateCode: 51 },
  { name: 'Ordu', plateCode: 52 },
  { name: 'Rize', plateCode: 53 },
  { name: 'Sakarya', plateCode: 54 },
  { name: 'Samsun', plateCode: 55 },
  { name: 'Siirt', plateCode: 56 },
  { name: 'Sinop', plateCode: 57 },
  { name: 'Sivas', plateCode: 58 },
  { name: 'Tekirdağ', plateCode: 59 },
  { name: 'Tokat', plateCode: 60 },
  { name: 'Trabzon', plateCode: 61 },
  { name: 'Tunceli', plateCode: 62 },
  { name: 'Şanlıurfa', plateCode: 63 },
  { name: 'Uşak', plateCode: 64 },
  { name: 'Van', plateCode: 65 },
  { name: 'Yozgat', plateCode: 66 },
  { name: 'Zonguldak', plateCode: 67 },
  { name: 'Aksaray', plateCode: 68 },
  { name: 'Bayburt', plateCode: 69 },
  { name: 'Karaman', plateCode: 70 },
  { name: 'Kırıkkale', plateCode: 71 },
  { name: 'Batman', plateCode: 72 },
  { name: 'Şırnak', plateCode: 73 },
  { name: 'Bartın', plateCode: 74 },
  { name: 'Ardahan', plateCode: 75 },
  { name: 'Iğdır', plateCode: 76 },
  { name: 'Yalova', plateCode: 77 },
  { name: 'Karabük', plateCode: 78 },
  { name: 'Kilis', plateCode: 79 },
  { name: 'Osmaniye', plateCode: 80 },
  { name: 'Düzce', plateCode: 81 }
];

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const toSlug = (value) =>
  normalize(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const run = async () => {
  await connectDB();

  const normalizedCities = TURKEY_CITIES.map((item) => ({
    name: normalize(item.name),
    plateCode: Number(item.plateCode)
  })).filter((item) => item.name && Number.isInteger(item.plateCode));

  const names = normalizedCities.map((item) => item.name);
  const plateCodes = normalizedCities.map((item) => item.plateCode);

  const existing = await City.find({
    $or: [{ name: { $in: names } }, { plateCode: { $in: plateCodes } }]
  })
    .select('name plateCode')
    .lean();

  const existingNameSet = new Set(existing.map((item) => item.name));
  const existingPlateSet = new Set(existing.map((item) => Number(item.plateCode)));

  const docsToInsert = normalizedCities
    .filter((item) => !existingNameSet.has(item.name) && !existingPlateSet.has(item.plateCode))
    .map((item) => ({
      name: item.name,
      plateCode: item.plateCode,
      slug: toSlug(item.name)
    }));

  let insertedCount = 0;
  if (docsToInsert.length > 0) {
    const inserted = await City.insertMany(docsToInsert, { ordered: false });
    insertedCount = inserted.length;
  }

  console.log(`Inserted cities: ${insertedCount}`);
  console.log(`Total cities in collection: ${await City.countDocuments()}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('seedCities failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
