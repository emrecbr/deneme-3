import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';

const userRoutes = Router();

userRoutes.post('/favorite/:rfqId', authMiddleware, async (req, res, next) => {
  try {
    const { rfqId } = req.params;
    const userId = req.user.id;

    const rfq = await RFQ.findById(rfqId);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    const user = await User.findById(userId).select('favorites');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const alreadyFavorite = user.favorites.some((item) => item.toString() === rfqId);

    if (alreadyFavorite) {
      user.favorites = user.favorites.filter((item) => item.toString() !== rfqId);
      await user.save();
      await RFQ.updateOne({ _id: rfqId }, { $inc: { favoriteCount: -1 } });
    } else {
      user.favorites.push(rfq._id);
      await user.save();
      await RFQ.updateOne({ _id: rfqId }, { $inc: { favoriteCount: 1 } });
    }

    const updatedRFQ = await RFQ.findById(rfqId).select('favoriteCount');

    return res.status(200).json({
      success: true,
      data: {
        isFavorite: !alreadyFavorite,
        favoriteCount: updatedRFQ?.favoriteCount || 0,
        favorites: user.favorites
      }
    });
  } catch (error) {
    return next(error);
  }
});

userRoutes.get('/favorites', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'favorites',
      populate: {
        path: 'buyer',
        select: 'name email'
      },
      options: { sort: { createdAt: -1 } }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: user.favorites || []
    });
  } catch (error) {
    return next(error);
  }
});

export default userRoutes;
