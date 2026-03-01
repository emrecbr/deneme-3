import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import City from '../models/City.js';
import District from '../models/District.js';
import Neighborhood from '../models/Neighborhood.js';
import Street from '../models/Street.js';

dotenv.config();

const INPUT_PATH = process.argv[2] || path.resolve('scripts/data/turkey-location-standard.sample.json');
const STREET_TYPES = new Set(['Cadde', 'Sokak']);
const BULK_SIZE = 5000;

const toTitleCaseTr = (value) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }
  return clean
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');
};

const normalizePlateCode = (value) => String(value || '').replace(/\D/g, '').padStart(2, '0').slice(-2);

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const parseTree = (payload) => {
  const cityMap = new Map();
  const districtMap = new Map();
  const neighborhoodMap = new Map();
  const streetMap = new Map();

  const roots = Array.isArray(payload) ? payload : payload?.cities || payload?.data || [];

  roots.forEach((entry) => {
    const cityNode = entry?.city || entry;
    const cityName = toTitleCaseTr(cityNode?.name);
    const plateCode = normalizePlateCode(cityNode?.plateCode);
    if (!cityName || !plateCode) {
      return;
    }

    const cityKey = `${plateCode}|${cityName}`;
    cityMap.set(cityKey, { name: cityName, plateCode });

    const districts = Array.isArray(cityNode?.districts) ? cityNode.districts : [];
    districts.forEach((districtNode) => {
      const districtName = toTitleCaseTr(districtNode?.name);
      if (!districtName) {
        return;
      }
      const districtKey = `${cityKey}|${districtName}`;
      districtMap.set(districtKey, {
        cityKey,
        name: districtName
      });

      const neighborhoods = Array.isArray(districtNode?.neighborhoods) ? districtNode.neighborhoods : [];
      neighborhoods.forEach((neighborhoodNode) => {
        const neighborhoodName = toTitleCaseTr(neighborhoodNode?.name);
        if (!neighborhoodName) {
          return;
        }
        const neighborhoodKey = `${districtKey}|${neighborhoodName}`;
        neighborhoodMap.set(neighborhoodKey, {
          districtKey,
          name: neighborhoodName
        });

        const streets = Array.isArray(neighborhoodNode?.streets) ? neighborhoodNode.streets : [];
        streets.forEach((streetNode) => {
          const streetName = toTitleCaseTr(streetNode?.name);
          const streetType = toTitleCaseTr(streetNode?.type);
          if (!streetName || !STREET_TYPES.has(streetType)) {
            return;
          }
          const streetKey = `${neighborhoodKey}|${streetType}|${streetName}`;
          streetMap.set(streetKey, {
            neighborhoodKey,
            name: streetName,
            type: streetType
          });
        });
      });
    });
  });

  return {
    cities: [...cityMap.values()],
    districts: [...districtMap.values()],
    neighborhoods: [...neighborhoodMap.values()],
    streets: [...streetMap.values()]
  };
};

const runBulk = async (Model, operations, session) => {
  if (!operations.length) {
    return;
  }
  for (const batch of chunk(operations, BULK_SIZE)) {
    await Model.bulkWrite(batch, {
      ordered: false,
      ...(session ? { session } : {})
    });
  }
};

const seedOnce = async (tree, session = null) => {
  const cityOps = tree.cities.map((city) => ({
    updateOne: {
      filter: { plateCode: city.plateCode },
      update: { $set: { name: city.name, plateCode: city.plateCode } },
      upsert: true
    }
  }));
  await runBulk(City, cityOps, session);

  const cityDocs = await City.find({ plateCode: { $in: tree.cities.map((city) => city.plateCode) } })
    .select('_id name plateCode')
    .lean()
    .session(session);
  const cityIdByKey = new Map(cityDocs.map((city) => [`${city.plateCode}|${city.name}`, city._id.toString()]));

  const districtOps = tree.districts
    .map((district) => {
      const cityId = cityIdByKey.get(district.cityKey);
      if (!cityId) {
        return null;
      }
      return {
        updateOne: {
          filter: {
            name: district.name,
            cityId
          },
          update: {
            $set: {
              name: district.name,
              cityId
            }
          },
          upsert: true
        }
      };
    })
    .filter(Boolean);
  await runBulk(District, districtOps, session);

  const districtDocs = await District.find({ cityId: { $in: [...new Set([...cityIdByKey.values()])] } })
    .select('_id name cityId')
    .lean()
    .session(session);
  const districtIdByKey = new Map();
  districtDocs.forEach((district) => {
    const city = cityDocs.find((item) => item._id.toString() === district.cityId.toString());
    if (!city) {
      return;
    }
    districtIdByKey.set(`${city.plateCode}|${city.name}|${district.name}`, district._id.toString());
  });

  const neighborhoodOps = tree.neighborhoods
    .map((neighborhood) => {
      const districtId = districtIdByKey.get(neighborhood.districtKey);
      if (!districtId) {
        return null;
      }
      return {
        updateOne: {
          filter: {
            name: neighborhood.name,
            districtId
          },
          update: {
            $set: {
              name: neighborhood.name,
              districtId
            }
          },
          upsert: true
        }
      };
    })
    .filter(Boolean);
  await runBulk(Neighborhood, neighborhoodOps, session);

  const neighborhoodDocs = await Neighborhood.find({
    districtId: { $in: [...new Set([...districtIdByKey.values()])] }
  })
    .select('_id name districtId')
    .lean()
    .session(session);
  const neighborhoodIdByKey = new Map();
  neighborhoodDocs.forEach((neighborhood) => {
    const district = districtDocs.find((item) => item._id.toString() === neighborhood.districtId.toString());
    if (!district) {
      return;
    }
    const city = cityDocs.find((item) => item._id.toString() === district.cityId.toString());
    if (!city) {
      return;
    }
    neighborhoodIdByKey.set(
      `${city.plateCode}|${city.name}|${district.name}|${neighborhood.name}`,
      neighborhood._id.toString()
    );
  });

  const streetOps = tree.streets
    .map((street) => {
      const neighborhoodId = neighborhoodIdByKey.get(street.neighborhoodKey);
      if (!neighborhoodId) {
        return null;
      }
      return {
        updateOne: {
          filter: {
            name: street.name,
            type: street.type,
            neighborhoodId
          },
          update: {
            $set: {
              name: street.name,
              type: street.type,
              neighborhoodId
            }
          },
          upsert: true
        }
      };
    })
    .filter(Boolean);
  await runBulk(Street, streetOps, session);
};

const run = async () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const tree = parseTree(parsed);

  await connectDB();

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    await seedOnce(tree, session);
    await session.commitTransaction();
    console.log('TURKEY NORMALIZED LOCATION SEED COMPLETED (transaction)');
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    if (String(error?.message || '').includes('Transaction numbers are only allowed')) {
      await seedOnce(tree, null);
      console.log('TURKEY NORMALIZED LOCATION SEED COMPLETED (non-transaction fallback)');
    } else {
      throw error;
    }
  } finally {
    if (session) {
      await session.endSession();
    }
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error('seedTurkeyNormalized failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
