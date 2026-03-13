import mongoose from 'mongoose';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import AuthLog from '../models/AuthLog.js';
import SearchLog from '../models/SearchLog.js';
import Category from '../models/Category.js';
import City from '../models/City.js';
import District from '../models/District.js';

const normalize = (value) => String(value || '').trim();

const toCsv = (rows) => {
  const escape = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(row[key])).join(','));
  });
  return lines.join('\n');
};

const logExport = async (req, type, count) => {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action: 'export',
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta: { type, count }
    });
  } catch (_error) {
    // ignore audit errors
  }
};

export const exportData = async (req, res, next) => {
  try {
    const type = normalize(req.query.type);
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);
    let rows = [];

    if (type === 'rfqs') {
      const q = normalize(req.query.q || req.query.search);
      const status = normalize(req.query.status);
      const userId = normalize(req.query.userId);
      const city = normalize(req.query.city);
      const district = normalize(req.query.district);
      const category = normalize(req.query.category);
      const query = {};
      if (status) query.status = status;
      if (q) {
        query.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
      }
      if (userId && mongoose.isValidObjectId(userId)) {
        query.buyer = new mongoose.Types.ObjectId(userId);
      }
      if (category) {
        if (mongoose.isValidObjectId(category)) {
          query.category = new mongoose.Types.ObjectId(category);
        } else {
          const catDoc = await Category.findOne({ slug: category }).lean();
          if (catDoc?._id) query.category = catDoc._id;
        }
      }
      if (city) {
        if (mongoose.isValidObjectId(city)) {
          query.city = new mongoose.Types.ObjectId(city);
        } else {
          const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') }).lean();
          if (cityDoc?._id) query.city = cityDoc._id;
        }
      }
      if (district) {
        if (mongoose.isValidObjectId(district)) {
          query.district = new mongoose.Types.ObjectId(district);
        } else {
          const distDoc = await District.findOne({ name: new RegExp(`^${district}$`, 'i') }).lean();
          if (distDoc?._id) query.district = distDoc._id;
        }
      }
      const rfqs = await RFQ.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('buyer', 'email')
        .populate('city', 'name')
        .populate('district', 'name')
        .lean();
      rows = rfqs.map((rfq) => ({
        id: rfq._id,
        title: rfq.title,
        status: rfq.status,
        buyer: rfq.buyer?.email || '',
        city: rfq.city?.name || rfq.locationData?.city || '',
        district: rfq.district?.name || rfq.locationData?.district || '',
        createdAt: rfq.createdAt
      }));
    } else if (type === 'users') {
      const role = normalize(req.query.role);
      const status = normalize(req.query.status);
      const query = {};
      if (role) query.role = role;
      if (status === 'active') {
        query.isActive = true;
        query.isDeleted = { $ne: true };
      } else if (status === 'passive') {
        query.isActive = false;
      } else if (status === 'blocked') {
        query.isDeleted = true;
      }
      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name email phone role isActive isDeleted createdAt lastLoginAt')
        .lean();
      rows = users.map((user) => ({
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
        status: user.isDeleted ? 'blocked' : user.isActive ? 'active' : 'passive',
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || ''
      }));
    } else if (type === 'audit') {
      const logs = await AdminAuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      rows = logs.map((log) => ({
        id: log._id,
        action: log.action,
        role: log.role || '',
        adminId: log.adminId || '',
        createdAt: log.createdAt
      }));
    } else if (type === 'otp' || type === 'sms') {
      const logs = await AuthLog.find({ channel: type === 'otp' ? 'email' : 'sms' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      rows = logs.map((log) => ({
        id: log._id,
        event: log.event,
        status: log.status,
        target: log.maskedTarget || log.target || '',
        createdAt: log.createdAt
      }));
    } else if (type === 'search') {
      const logs = await SearchLog.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      const categories = await Category.find({ _id: { $in: logs.map((log) => log.categoryId).filter(Boolean) } })
        .select('name')
        .lean();
      const categoryMap = new Map(categories.map((item) => [String(item._id), item.name]));
      rows = logs.map((log) => ({
        id: log._id,
        term: log.term,
        results: log.resultsCount || 0,
        category: log.categoryId ? categoryMap.get(String(log.categoryId)) || '' : '',
        source: log.source,
        createdAt: log.createdAt
      }));
    } else {
      return res.status(400).json({ success: false, message: 'Geçersiz export tipi.' });
    }

    await logExport(req, type, rows.length);

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-export.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};
