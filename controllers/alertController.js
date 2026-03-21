import mongoose from 'mongoose';
import NotificationSubscription from '../models/NotificationSubscription.js';
import SubscriptionMatch from '../models/SubscriptionMatch.js';
import { buildSubscriptionPayload, listUserSubscriptionsWithMatches } from '../src/services/alertSubscriptionService.js';

const buildDisplay = (item) => ({
  ...item,
  categoryName: item.category?.name || '',
  cityName: item.city?.name || '',
  districtName: item.district?.name || ''
});

export const listMyAlerts = async (req, res, next) => {
  try {
    const items = await listUserSubscriptionsWithMatches(req.user.id);
    return res.status(200).json({
      success: true,
      items: items.map(buildDisplay)
    });
  } catch (error) {
    return next(error);
  }
};

export const createMyAlert = async (req, res, next) => {
  try {
    const body = req.body || {};
    const type = body.type;
    const categoryId = body.categoryId?._id || body.categoryId || body.category?._id || body.category;
    const cityId = body.cityId?._id || body.cityId || body.city?._id || body.city;
    const districtId = body.districtId?._id || body.districtId || body.district?._id || body.district;
    const keyword = body.keyword;
    const notifyPush = body.notifyPush;
    const notifyInApp = body.notifyInApp;

    if (categoryId && !mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: 'Kategori gecersiz.' });
    }
    if (cityId && !mongoose.isValidObjectId(cityId)) {
      return res.status(400).json({ success: false, message: 'Sehir gecersiz.' });
    }
    if (districtId && !mongoose.isValidObjectId(districtId)) {
      return res.status(400).json({ success: false, message: 'Ilce gecersiz.' });
    }

    const payload = buildSubscriptionPayload({ type, categoryId, cityId, districtId, keyword, notifyPush, notifyInApp });
    if (payload.error === 'keyword_required') {
      return res.status(400).json({ success: false, message: 'Anahtar kelime zorunludur.' });
    }
    if (payload.error === 'category_required') {
      return res.status(400).json({ success: false, message: 'Kategori zorunludur.' });
    }
    if (payload.error === 'city_required') {
      return res.status(400).json({ success: false, message: 'Sehir zorunludur.' });
    }
    if (payload.error === 'district_required') {
      return res.status(400).json({ success: false, message: 'Ilce zorunludur.' });
    }
    if (payload.error) {
      return res.status(400).json({ success: false, message: 'Takip tipi gecersiz.' });
    }

    const subscription = await NotificationSubscription.create({
      user: req.user.id,
      ...payload
    });

    const populated = await NotificationSubscription.findById(subscription._id)
      .populate('category', 'name')
      .populate('city', 'name')
      .populate('district', 'name')
      .lean();

    return res.status(201).json({
      success: true,
      data: buildDisplay(populated)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Bu takip zaten mevcut.'
      });
    }
    return next(error);
  }
};

export const updateMyAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, notifyPush, notifyInApp } = req.body || {};

    const subscription = await NotificationSubscription.findOne({
      _id: id,
      user: req.user.id
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Takip bulunamadi.' });
    }

    if (typeof isActive === 'boolean') subscription.isActive = isActive;
    if (typeof notifyPush === 'boolean') subscription.notifyPush = notifyPush;
    if (typeof notifyInApp === 'boolean') subscription.notifyInApp = notifyInApp;

    await subscription.save();
    const populated = await NotificationSubscription.findById(subscription._id)
      .populate('category', 'name')
      .populate('city', 'name')
      .populate('district', 'name')
      .lean();

    return res.status(200).json({ success: true, data: buildDisplay(populated) });
  } catch (error) {
    return next(error);
  }
};

export const deleteMyAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const removed = await NotificationSubscription.findOneAndDelete({
      _id: id,
      user: req.user.id
    });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Takip bulunamadi.' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const markMatchSeen = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Match id gecersiz.' });
    }
    const match = await SubscriptionMatch.findOne({
      _id: id,
      user: req.user.id
    });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match bulunamadi.' });
    }
    match.isSeen = true;
    await match.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
