import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\-]/g, '');
}

function inferSegment(nodeName, inheritedSegment = '') {
  if (inheritedSegment) return inheritedSegment;
  const normalized = slugify(String(nodeName || ''));
  if (['araba', 'motosiklet', 'diger-araclar'].includes(normalized)) {
    return 'auto';
  }
  return 'goods';
}

const CATEGORY_TREE = [
  {
    name: 'Araba',
    segment: 'auto',
    children: [
      { name: 'Motor & Mekanik' },
      { name: 'Fren & Süspansiyon' },
      { name: 'Elektrik & Elektronik' },
      { name: 'Filtre & Yağ & Sıvılar' },
      { name: 'Kaporta & Dış Aksam' },
      { name: 'İç Aksam' },
      { name: 'Klima & Isıtma' },
      { name: 'Lastik & Jant' }
    ]
  },
  {
    name: 'Telefon',
    segment: 'goods',
    children: [
      { name: 'iPhone iOS Telefon', children: [{ name: 'iPhone 17 Pro Max' }, { name: 'iPhone 16' }] },
      { name: 'Android Telefon', children: [{ name: 'Samsung' }, { name: 'Xiaomi' }, { name: 'Huawei' }] },
      { name: 'Telefon Aksesuarları', children: [{ name: 'Şarj Cihazı' }, { name: 'Bluetooth Kulaklık' }] },
      { name: 'Telefon Yedek Parçaları', children: [{ name: 'Batarya' }, { name: 'Ekran' }] }
    ]
  },
  {
    name: 'Elektronik',
    segment: 'goods',
    children: [
      { name: 'Bilgisayar', children: [{ name: 'Dizüstü' }, { name: 'Masaüstü' }, { name: 'Monitör' }] },
      { name: 'Tablet' },
      { name: 'TV, Görüntü & Ses Sistemi' },
      { name: 'Beyaz Eşya' },
      { name: 'Elektrikli Ev Aletleri' },
      { name: 'Fotoğraf & Kamera' },
      { name: 'Giyilebilir Teknoloji' }
    ]
  },
  {
    name: 'Ev & Yaşam',
    children: [
      { name: 'Oturma Odası' },
      { name: 'Yatak Odası' },
      { name: 'Mutfak & Banyo' },
      { name: 'Ev Tekstili' },
      { name: 'Aydınlatma' },
      { name: 'Ev Dekorasyonu' }
    ]
  },
  {
    name: 'Motosiklet',
    segment: 'auto',
    children: [
      { name: 'Scooter' },
      { name: 'Touring' },
      { name: 'Motosiklet Ekipman' },
      { name: 'Motosiklet Yedek Parça' }
    ]
  },
  {
    name: 'Giyim & Aksesuar',
    segment: 'goods',
    children: [
      { name: 'Kadın', children: [{ name: 'Üst Giyim' }, { name: 'Alt Giyim' }, { name: 'Elbise' }] },
      { name: 'Erkek', children: [{ name: 'Üst Giyim' }, { name: 'Alt Giyim' }] },
      { name: 'Kız Çocuk' },
      { name: 'Erkek Çocuk' }
    ]
  },
  {
    name: 'Kişisel Bakım & Kozmetik',
    children: [{ name: 'Saç Bakımı' }, { name: 'Cilt Bakımı' }, { name: 'Parfüm' }, { name: 'Makyaj' }]
  },
  {
    name: 'Anne & Bebek & Oyuncak',
    children: [{ name: 'Bebek Araç & Gereçleri' }, { name: 'Bebek Giyim' }, { name: 'Oyuncak' }]
  },
  {
    name: 'Hobi & Kitap & Müzik',
    children: [{ name: 'Kitap' }, { name: 'Müzik & Müzik Aletleri' }, { name: 'Hobi' }, { name: 'Koleksiyon' }]
  },
  {
    name: 'Ofis & Kırtasiye',
    children: [{ name: 'Ofis Teknolojileri' }, { name: 'Ofis Mobilyaları' }, { name: 'Okul & Kırtasiye' }]
  },
  {
    name: 'Spor & Outdoor',
    children: [
      { name: 'Bisiklet' },
      { name: 'Fitness Sporları' },
      { name: 'Kış Sporları' },
      { name: 'Su Sporları' },
      { name: 'Doğa Sporları' },
      { name: 'Takım Sporları' }
    ]
  },
  {
    name: 'Diğer Araçlar',
    children: [{ name: 'Kamyon' }, { name: 'Karavan' }, { name: 'Tekne' }, { name: 'Jet Ski' }]
  },
  {
    name: 'Yapı Market & Bahçe',
    children: [{ name: 'El Aletleri' }, { name: 'Elektrikli El Aletleri' }, { name: 'Bahçe Makinesi' }, { name: 'Mangal & Barbekü' }]
  },
  {
    name: 'Pet Shop',
    children: [{ name: 'Köpek Ürünleri' }, { name: 'Kedi Ürünleri' }, { name: 'Balık Ürünleri' }, { name: 'Kuş Ürünleri' }]
  },
  {
    name: 'Antika',
    children: [{ name: 'Mobilya' }, { name: 'Dekorasyon' }, { name: 'Aydınlatma' }, { name: 'Enstrüman' }]
  }
];

const createCategories = async (nodes, parent = null, level = 0, parentSlug = '', inheritedSegment = '') => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const localSlug = slugify(node.name);
    const fullSlug = parentSlug ? `${parentSlug}-${localSlug}` : localSlug;
    const segment = node.segment || inferSegment(node.name, inheritedSegment) || undefined;

    const created = await Category.findOneAndUpdate(
      { slug: fullSlug },
      {
        $set: {
          name: node.name,
          slug: fullSlug,
          segment,
          parent,
          level,
          order: index
        }
      },
      { new: true, upsert: true }
    );

    if (Array.isArray(node.children) && node.children.length > 0) {
      await createCategories(node.children, created._id, level + 1, fullSlug, segment);
    }
  }
};

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI tanimli degil.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  await createCategories(CATEGORY_TREE);

  console.log('FULL MARKETPLACE CATEGORY TREE SEEDED');
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error('SEED FULL CATEGORY ERROR:', error);
  await mongoose.disconnect();
  process.exit(1);
});
