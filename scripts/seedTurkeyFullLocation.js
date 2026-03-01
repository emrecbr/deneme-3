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

const DEFAULT_INPUT = path.resolve('scripts/data/turkey-location-standard.full.json');
const FALLBACK_INPUT = path.resolve('scripts/data/turkey-location-standard.sample.json');
const INPUT_PATH = process.argv[2] || (fs.existsSync(DEFAULT_INPUT) ? DEFAULT_INPUT : FALLBACK_INPUT);
const STREET_TYPES = new Set(['Cadde', 'Sokak']);

const toSlug = (value) =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const parsePayload = (payload) => {
  const roots = Array.isArray(payload) ? payload : payload?.cities || payload?.data || [];
  const tree = [];

  roots.forEach((entry) => {
    const cityNode = entry?.city || entry;
    const cityName = normalize(cityNode?.name);
    if (!cityName) {
      return;
    }

    const districts = Array.isArray(cityNode?.districts) ? cityNode.districts : [];
    tree.push({
      name: cityName,
      slug: toSlug(cityName),
      districts: districts.map((districtNode) => ({
        name: normalize(districtNode?.name),
        neighborhoods: (Array.isArray(districtNode?.neighborhoods) ? districtNode.neighborhoods : []).map(
          (neighborhoodNode) => ({
            name: normalize(neighborhoodNode?.name),
            streets: (Array.isArray(neighborhoodNode?.streets) ? neighborhoodNode.streets : [])
              .map((streetNode) => ({
                name: normalize(streetNode?.name),
                type: normalize(streetNode?.type)
              }))
              .filter((street) => street.name && STREET_TYPES.has(street.type))
          })
        )
      }))
    });
  });

  return tree;
};

const run = async () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const tree = parsePayload(parsed);

  await connectDB();

  for (const cityData of tree) {
    if (!cityData.name) {
      continue;
    }

    const city = await City.findOneAndUpdate(
      { name: cityData.name },
      { $set: { name: cityData.name, slug: cityData.slug } },
      { upsert: true, new: true }
    )
      .select('_id name')
      .lean();

    for (const districtData of cityData.districts) {
      if (!districtData.name) {
        continue;
      }

      const district = await District.findOneAndUpdate(
        {
          name: districtData.name,
          city: city._id
        },
        {
          $set: {
            name: districtData.name,
            city: city._id
          }
        },
        { upsert: true, new: true }
      )
        .select('_id name city')
        .lean();

      for (const neighborhoodData of districtData.neighborhoods) {
        if (!neighborhoodData.name) {
          continue;
        }

        const neighborhood = await Neighborhood.findOneAndUpdate(
          {
            name: neighborhoodData.name,
            district: district._id
          },
          {
            $set: {
              name: neighborhoodData.name,
              city: city._id,
              district: district._id
            }
          },
          { upsert: true, new: true }
        )
          .select('_id name district')
          .lean();

        for (const streetData of neighborhoodData.streets) {
          if (!streetData.name || !STREET_TYPES.has(streetData.type)) {
            continue;
          }

          await Street.findOneAndUpdate(
            {
              name: streetData.name,
              type: streetData.type,
              neighborhood: neighborhood._id
            },
            {
              $set: {
                name: streetData.name,
                type: streetData.type,
                neighborhood: neighborhood._id
              }
            },
            { upsert: true }
          );
        }
      }
    }
  }

  const [cityCount, districtCount, neighborhoodCount, streetCount] = await Promise.all([
    City.countDocuments(),
    District.countDocuments(),
    Neighborhood.countDocuments(),
    Street.countDocuments()
  ]);

  console.log(`Seed file: ${INPUT_PATH}`);
  console.log(`Cities: ${cityCount}`);
  console.log(`Districts: ${districtCount}`);
  console.log(`Neighborhoods: ${neighborhoodCount}`);
  console.log(`Streets: ${streetCount}`);
  console.log(`Total: ${cityCount + districtCount + neighborhoodCount + streetCount}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('seedTurkeyFullLocation failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
