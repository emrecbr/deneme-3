import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';

const SEGMENTS = ['goods', 'service', 'auto', 'jobseeker'];

const TAXONOMY = {
  goods: [
    {
      name: 'Ev & Yaşam',
      aliases: ['ev ve yaşam', 'ev & yasam'],
      children: [
        { name: 'Dekorasyon', aliases: ['ev dekorasyonu'] },
        { name: 'Ev Tekstili' },
        { name: 'Aydınlatma' },
        { name: 'Halı / Perde' }
      ]
    },
    {
      name: 'Mobilya',
      children: [
        { name: 'Koltuk / Kanepe' },
        { name: 'Yatak / Baza' },
        { name: 'Masa / Sandalye' },
        { name: 'Gardırop / Dolap' },
        { name: 'TV Ünitesi' }
      ]
    },
    {
      name: 'Beyaz Eşya',
      children: [
        { name: 'Buzdolabı' },
        { name: 'Çamaşır Makinesi' },
        { name: 'Bulaşık Makinesi' },
        { name: 'Fırın' },
        { name: 'Derin Dondurucu' }
      ]
    },
    {
      name: 'Elektronik',
      children: [
        { name: 'TV' },
        { name: 'Bilgisayar' },
        { name: 'Telefon / Tablet' },
        { name: 'Ses Sistemi' }
      ]
    },
    {
      name: 'Mutfak & Banyo',
      aliases: ['mutfak & banyo'],
      children: [
        { name: 'Mutfak Dolabı' },
        { name: 'Lavabo' },
        { name: 'Batarya / Musluk' },
        { name: 'Duş / Kabin' },
        { name: 'Ankastre' }
      ]
    }
  ],
  service: [
    {
      name: 'Tadilat & Onarım',
      children: [
        { name: 'Elektrikçi' },
        { name: 'Tesisatçı' },
        { name: 'Boyacı / Badana' },
        { name: 'Alçı / Sıva' },
        { name: 'Fayans / Seramik' },
        { name: 'Parke' }
      ]
    },
    {
      name: 'Temizlik',
      children: [
        { name: 'Ev Temizliği' },
        { name: 'Ofis Temizliği' },
        { name: 'İnşaat Sonrası Temizlik' },
        { name: 'Koltuk / Halı Yıkama' }
      ]
    },
    {
      name: 'Kurulum & Montaj',
      children: [
        { name: 'Mobilya Montaj' },
        { name: 'TV Montaj' },
        { name: 'Beyaz Eşya Kurulumu' },
        { name: 'Avize / Aydınlatma Montajı' }
      ]
    },
    {
      name: 'Nakliye & Taşıma',
      aliases: ['nakliye'],
      children: [
        { name: 'Evden Eve Nakliyat' },
        { name: 'Parça Eşya Taşıma' },
        { name: 'Ofis Taşıma' }
      ]
    },
    {
      name: 'Teknik Servis',
      children: [
        { name: 'Beyaz Eşya Servisi' },
        { name: 'Klima Servisi' },
        { name: 'Kombi Servisi' },
        { name: 'Bilgisayar Servisi' }
      ]
    }
  ],
  auto: [
    {
      name: 'Bakım & Servis',
      children: [
        { name: 'Periyodik Bakım' },
        { name: 'Yağ / Filtre' },
        { name: 'Fren' },
        { name: 'Akü' },
        { name: 'Mekanik Arıza' }
      ]
    },
    {
      name: 'Yedek Parça',
      children: [
        { name: 'Motor Parçası' },
        { name: 'Fren Parçası' },
        { name: 'Süspansiyon' },
        { name: 'Aydınlatma' }
      ]
    },
    {
      name: 'Lastik & Jant',
      children: [
        { name: 'Yaz Lastiği' },
        { name: 'Kış Lastiği' },
        { name: '4 Mevsim' },
        { name: 'Jant' }
      ]
    },
    {
      name: 'Kaporta & Boya',
      children: [
        { name: 'Mini Onarım' },
        { name: 'Göçük Düzeltme' },
        { name: 'Boya' }
      ]
    },
    {
      name: 'Temizlik & Detay',
      children: [
        { name: 'İç Dış Yıkama' },
        { name: 'Detaylı Temizlik' },
        { name: 'Pasta Cila' }
      ]
    }
  ],
  jobseeker: [
    {
      name: 'İş Alanları',
      aliases: ['iş alanları', 'is alanlari'],
      children: [
        { name: 'Temizlik' },
        { name: 'Garson / Servis' },
        { name: 'Depo / Lojistik' },
        { name: 'Şoför / Kurye' },
        { name: 'Ofis Destek' },
        { name: 'Satış / Mağaza' },
        { name: 'Teknik / Usta Yardımcısı' },
        { name: 'Çocuk / Yaşlı Bakımı' },
        { name: 'Güvenlik' },
        { name: 'Çağrı Merkezi' },
        { name: 'Diğer' }
      ]
    }
  ]
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ve ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildNodes() {
  const nodes = [];

  const walk = (segment, items, parentKey = null, pathParts = []) => {
    items.forEach((item, index) => {
      const path = [...pathParts, item.name];
      const key = `${segment}:${path.map((part) => normalizeText(part)).join('>')}`;
      const kind = item.children?.length ? (parentKey ? 'branch' : 'root') : 'leaf';
      const node = {
        key,
        segment,
        name: item.name,
        aliases: uniqueValues([item.name, ...(item.aliases || [])]),
        level: path.length - 1,
        order: index,
        kind,
        parentKey,
        path,
        slug: `${segment}-${path.map((part) => slugify(part)).join('-')}`,
        children: item.children || []
      };
      nodes.push(node);
      if (item.children?.length) {
        walk(segment, item.children, key, path);
      }
    });
  };

  Object.entries(TAXONOMY).forEach(([segment, items]) => walk(segment, items));
  return nodes;
}

function buildNameMap(categories) {
  const map = new Map();
  categories.forEach((category) => {
    const key = normalizeText(category.name);
    const list = map.get(key) || [];
    list.push(category);
    map.set(key, list);
  });
  return map;
}

function safeParentId(value) {
  return value ? String(value) : null;
}

function buildAuditSummary(categories) {
  return {
    total: categories.length,
    bySegment: SEGMENTS.map((segment) => ({
      segment,
      count: categories.filter((item) => item.segment === segment).length
    })),
    noSegment: categories.filter((item) => !item.segment).length,
    roots: categories.filter((item) => !item.parent).length,
    invalidLevel: categories.filter((item) => Number(item.level) !== 0 && !item.parent).length
  };
}

async function main() {
  const auditOnly = process.argv.includes('--audit-only');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI tanimli degil.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await Category.find().lean();
  const nameMap = buildNameMap(existing);
  const slugMap = new Map(existing.map((item) => [String(item.slug || ''), item]));
  const touchedIds = new Set();
  const resolved = new Map();
  const nodes = buildNodes();

  const summary = {
    auditBefore: buildAuditSummary(existing),
    reused: [],
    created: [],
    updated: [],
    cleanedSegments: []
  };

  const isSafeRootReuse = (node, candidate) => {
    if (node.segment === 'goods' && node.name === 'Mobilya' && candidate.parent) return false;
    return true;
  };

  const selectExistingCategory = (node, parentId) => {
    if (slugMap.has(node.slug)) {
      return slugMap.get(node.slug);
    }

    const parentScoped = [];
    node.aliases.forEach((alias) => {
      const candidates = nameMap.get(normalizeText(alias)) || [];
      candidates.forEach((candidate) => {
        const candidateParentId = safeParentId(candidate.parent);
        if (parentId === null) {
          if (candidateParentId === null && isSafeRootReuse(node, candidate)) {
            parentScoped.push(candidate);
          }
        } else if (candidateParentId === String(parentId)) {
          parentScoped.push(candidate);
        }
      });
    });

    if (parentScoped.length === 1) {
      return parentScoped[0];
    }

    if (parentId !== null) {
      return null;
    }

    const globalUniqueMatches = [];
    node.aliases.forEach((alias) => {
      const candidates = nameMap.get(normalizeText(alias)) || [];
      if (candidates.length === 1 && isSafeRootReuse(node, candidates[0])) {
        globalUniqueMatches.push(candidates[0]);
      }
    });

    return globalUniqueMatches.length === 1 ? globalUniqueMatches[0] : null;
  };

  for (const node of nodes) {
    const parentDoc = node.parentKey ? resolved.get(node.parentKey) || null : null;
    const parentId = parentDoc ? parentDoc._id : null;
    const existingDoc = selectExistingCategory(node, parentId);
    const payload = {
      name: node.name,
      segment: node.segment,
      kind: node.kind,
      parent: parentId,
      level: node.level,
      order: node.order,
      isActive: true
    };

    if (existingDoc) {
      const update = {
        ...payload,
        slug: existingDoc.slug || node.slug
      };
      const updated = await Category.findByIdAndUpdate(existingDoc._id, { $set: update }, { new: true }).lean();
      resolved.set(node.key, updated);
      touchedIds.add(String(updated._id));
      summary.reused.push({
        id: String(updated._id),
        key: node.key,
        fromSlug: existingDoc.slug || '',
        parent: parentId ? String(parentId) : null
      });
      summary.updated.push({
        id: String(updated._id),
        name: node.name,
        segment: node.segment,
        kind: node.kind
      });
      continue;
    }

    const created = await Category.create({
      ...payload,
      slug: node.slug
    });
    const createdLean = created.toObject();
    resolved.set(node.key, createdLean);
    touchedIds.add(String(created._id));
    slugMap.set(String(created.slug), createdLean);
    const list = nameMap.get(normalizeText(created.name)) || [];
    list.push(createdLean);
    nameMap.set(normalizeText(created.name), list);
    summary.created.push({
      id: String(created._id),
      key: node.key,
      slug: created.slug
    });
  }

  const orphanSegmented = await Category.find({
    segment: { $in: SEGMENTS },
    _id: { $nin: Array.from(touchedIds).map((id) => new mongoose.Types.ObjectId(id)) }
  }).select('_id name slug segment').lean();

  if (!auditOnly && orphanSegmented.length) {
    for (const item of orphanSegmented) {
      await Category.findByIdAndUpdate(item._id, {
        $unset: { segment: 1, kind: 1 }
      });
      summary.cleanedSegments.push({
        id: String(item._id),
        name: item.name,
        slug: item.slug,
        previousSegment: item.segment || ''
      });
    }
  }

  const after = await Category.find().lean();
  summary.auditAfter = buildAuditSummary(after);

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // ignore disconnect error
  }
  process.exit(1);
});
