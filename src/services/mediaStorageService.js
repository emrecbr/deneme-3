import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

const LOCAL_UPLOAD_DIR = path.resolve('uploads');
const DEFAULT_CLOUDINARY_HOME_FOLDER = 'talepet/home';
const DEFAULT_CLOUDINARY_MAIN_CATEGORY_FOLDER = 'talepet/categories/main';
const DEFAULT_CLOUDINARY_CHAT_FOLDER = 'talepet/chat';
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const normalizeProvider = () => String(process.env.MEDIA_STORAGE_PROVIDER || '').trim().toLowerCase();

const sanitizeName = (value = 'home-hero') => {
  const extension = path.extname(value);
  const base = path.basename(value, extension) || 'home-hero';
  return base
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56) || 'home-hero';
};

const getExtension = (mimeType) => MIME_EXTENSIONS[mimeType] || '.webp';

const assertCloudinaryConfig = () => {
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Cloudinary medya storage ortam değişkenleri eksik: ${missing.join(', ')}`);
  }
};

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
};

const uploadToCloudinary = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    assertCloudinaryConfig();
    configureCloudinary();

    const folder = options.folder || process.env.CLOUDINARY_HOME_FOLDER || DEFAULT_CLOUDINARY_HOME_FOLDER;
    const publicId = `${sanitizeName(options.originalName)}-${Date.now()}`;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          url: result.secure_url,
          provider: 'cloudinary',
          publicId: result.public_id,
          mimeType: options.mimeType,
          size: options.size || buffer.length
        });
      }
    );

    stream.end(buffer);
  });

const uploadToLocalStorage = async (buffer, options = {}) => {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const extension = getExtension(options.mimeType);
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${sanitizeName(options.originalName)}${extension}`;
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return {
    url: `/uploads/${filename}`,
    provider: 'local',
    filename,
    mimeType: options.mimeType,
    size: options.size || buffer.length
  };
};

export const getMediaProvider = () => normalizeProvider() || 'local';

export const uploadHomeHeroImage = async (buffer, options = {}) => {
  if (!buffer || !buffer.length) {
    throw new Error('Görsel dosyası boş.');
  }

  const provider = normalizeProvider();
  if (provider === 'cloudinary') {
    return uploadToCloudinary(buffer, options);
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('MEDIA_STORAGE_PROVIDER not configured, falling back to local uploads.');
  }
  return uploadToLocalStorage(buffer, options);
};

export const uploadMainCategoryImage = async (buffer, options = {}) => {
  if (!buffer || !buffer.length) {
    throw new Error('Görsel dosyası boş.');
  }

  const provider = normalizeProvider();
  if (provider === 'cloudinary') {
    return uploadToCloudinary(buffer, {
      ...options,
      folder: options.folder || DEFAULT_CLOUDINARY_MAIN_CATEGORY_FOLDER
    });
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('MEDIA_STORAGE_PROVIDER not configured, falling back to local uploads.');
  }
  return uploadToLocalStorage(buffer, options);
};

export const uploadChatImage = async (buffer, options = {}) => {
  if (!buffer || !buffer.length) {
    throw new Error('Görsel dosyası boş.');
  }

  const provider = normalizeProvider();
  if (provider === 'cloudinary') {
    return uploadToCloudinary(buffer, {
      ...options,
      folder: options.folder || DEFAULT_CLOUDINARY_CHAT_FOLDER
    });
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('MEDIA_STORAGE_PROVIDER not configured, falling back to local uploads.');
  }
  return uploadToLocalStorage(buffer, options);
};

export const deleteMediaAsset = async (publicId) => {
  if (!publicId || getMediaProvider() !== 'cloudinary') {
    return false;
  }
  assertCloudinaryConfig();
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  return true;
};
