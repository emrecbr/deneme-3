import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';

const CATEGORY_TREE = [
  {
    name: 'Elektronik',
    slug: 'elektronik',
    icon: 'smartphone',
    children: [
      { name: 'Telefon', slug: 'telefon' },
      { name: 'Tablet', slug: 'tablet' },
      { name: 'Bilgisayar', slug: 'bilgisayar' },
      { name: 'Laptop', slug: 'laptop' },
      { name: 'TV', slug: 'tv' },
      { name: 'Oyun Konsolu', slug: 'oyun-konsolu' }
    ]
  },
  {
    name: 'Ev & Yaşam',
    slug: 'ev-yasam',
    icon: 'home',
    children: [
      { name: 'Mobilya', slug: 'mobilya' },
      { name: 'Dekorasyon', slug: 'dekorasyon' },
      { name: 'Bahçe', slug: 'bahce' },
      { name: 'Mutfak', slug: 'mutfak' }
    ]
  },
  {
    name: 'Moda',
    slug: 'moda',
    icon: 'shirt',
    children: [
      { name: 'Kadın', slug: 'kadin' },
      { name: 'Erkek', slug: 'erkek' },
      { name: 'Çocuk', slug: 'cocuk' }
    ]
  },
  {
    name: 'Araba',
    slug: 'araba',
    icon: 'car',
    children: [
      { name: 'Motor & Mekanik', slug: 'motor-mekanik' },
      { name: 'Fren & Süspansiyon', slug: 'fren-suspansiyon' },
      { name: 'Elektrik & Elektronik', slug: 'elektrik-elektronik' },
      { name: 'Filtre & Yağ & Sıvılar', slug: 'filtre-yag-sivilar' },
      { name: 'Kaporta & Dış Aksam', slug: 'kaporta-dis-aksam' },
      { name: 'İç Aksam', slug: 'ic-aksam' },
      { name: 'Klima & Isıtma', slug: 'klima-isitma' },
      { name: 'Lastik & Jant', slug: 'lastik-jant' }
    ]
  },
  {
    name: 'Hizmet',
    slug: 'hizmet',
    icon: 'wrench',
    children: [
      { name: 'Temizlik', slug: 'temizlik' },
      { name: 'Nakliye', slug: 'nakliye' },
      { name: 'Yazılım', slug: 'yazilim' },
      { name: 'Grafik Tasarım', slug: 'grafik-tasarim' }
    ]
  },
  {
    name: 'İş & Freelance',
    slug: 'is-freelance',
    icon: 'briefcase',
    children: [
      { name: 'Yazılım Geliştirme', slug: 'yazilim-gelistirme' },
      { name: 'Video Edit', slug: 'video-edit' },
      { name: 'Sosyal Medya', slug: 'sosyal-medya' }
    ]
  }
];

const seedCategories = async () => {
  await connectDB();

  for (let parentIndex = 0; parentIndex < CATEGORY_TREE.length; parentIndex += 1) {
    const parent = CATEGORY_TREE[parentIndex];
    const parentCategory = await Category.findOneAndUpdate(
      { slug: parent.slug },
      {
        $set: {
          name: parent.name,
          slug: parent.slug,
          parent: null,
          icon: parent.icon || '',
          order: parentIndex
        }
      },
      { new: true, upsert: true }
    );

    for (let childIndex = 0; childIndex < parent.children.length; childIndex += 1) {
      const child = parent.children[childIndex];
      await Category.findOneAndUpdate(
        { slug: `${parent.slug}-${child.slug}` },
        {
          $set: {
            name: child.name,
            slug: `${parent.slug}-${child.slug}`,
            parent: parentCategory._id,
            icon: child.icon || '',
            order: childIndex
          }
        },
        { new: true, upsert: true }
      );
    }
  }

  const total = await Category.countDocuments();
  console.log(`Category seed tamamlandi. Toplam kategori: ${total}`);
};

seedCategories()
  .catch((error) => {
    console.error('Category seed hatasi:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
