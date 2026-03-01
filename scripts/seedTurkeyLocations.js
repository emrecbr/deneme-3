import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import City from '../models/City.js';
import District from '../models/District.js';
import Neighborhood from '../models/Neighborhood.js';

dotenv.config();

const DEFAULT_INPUT = path.resolve('scripts/data/turkey-location-standard.full.json');
const FALLBACK_INPUT = path.resolve('scripts/data/turkey-location-standard.sample.json');
const INPUT_PATH = process.argv[2] || (fs.existsSync(DEFAULT_INPUT) ? DEFAULT_INPUT : FALLBACK_INPUT);

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

const parsePayload = (payload) => {
  const roots = Array.isArray(payload) ? payload : payload?.cities || payload?.data || [];
  return roots
    .map((entry) => entry?.city || entry)
    .map((cityNode) => ({
      name: normalize(cityNode?.name),
      districts: (Array.isArray(cityNode?.districts) ? cityNode.districts : []).map((districtNode) => ({
        name: normalize(districtNode?.name),
        neighborhoods: (Array.isArray(districtNode?.neighborhoods) ? districtNode.neighborhoods : [])
          .map((neighborhoodNode) => ({
            name: normalize(neighborhoodNode?.name)
          }))
          .filter((item) => item.name)
      }))
    }))
    .filter((item) => item.name);
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
    const cityDoc = await City.findOneAndUpdate(
      { name: cityData.name },
      {
        $set: {
          name: cityData.name,
          slug: toSlug(cityData.name)
        }
      },
      { upsert: true, new: true }
    )
      .select('_id name')
      .lean();

    for (const districtData of cityData.districts) {
      if (!districtData.name) {
        continue;
      }

      const districtDoc = await District.findOneAndUpdate(
        {
          name: districtData.name,
          city: cityDoc._id
        },
        {
          $set: {
            name: districtData.name,
            city: cityDoc._id
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

        await Neighborhood.findOneAndUpdate(
          {
            name: neighborhoodData.name,
            district: districtDoc._id
          },
          {
            $set: {
              name: neighborhoodData.name,
              city: cityDoc._id,
              district: districtDoc._id
            }
          },
          { upsert: true }
        );
      }
    }
  }

  const [cityCount, districtCount, neighborhoodCount] = await Promise.all([
    City.countDocuments(),
    District.countDocuments(),
    Neighborhood.countDocuments()
  ]);

  console.log(`Seed file: ${INPUT_PATH}`);
  console.log(`Cities: ${cityCount}`);
  console.log(`Districts: ${districtCount}`);
  console.log(`Neighborhoods: ${neighborhoodCount}`);
  console.log(`Total: ${cityCount + districtCount + neighborhoodCount}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('seedTurkeyLocations failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
