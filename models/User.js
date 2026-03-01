import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    phoneE164: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RFQ'
      }
    ],
    role: {
      type: String,
      enum: ['buyer', 'supplier', 'admin'],
      default: 'buyer'
    },
    city: {
      type: String,
      trim: true
    },
    locationSelection: {
      city: {
        type: String,
        required: true,
        trim: true,
        default: 'Belirtilmedi'
      },
      district: {
        type: String,
        trim: true
      },
      neighborhood: {
        type: String,
        trim: true
      },
      street: {
        type: String,
        trim: true
      }
    },
    trustScore: {
      type: Number,
      default: 50
    },
    totalCompletedDeals: {
      type: Number,
      default: 0
    },
    positiveReviews: {
      type: Number,
      default: 0
    },
    negativeReviews: {
      type: Number,
      default: 0
    },
    isPremium: {
      type: Boolean,
      default: false
    },
    premiumUntil: {
      type: Date
    },
    premiumSource: {
      type: String,
      enum: ['payment', 'admin', 'promo'],
      default: 'payment'
    },
    featuredCredits: {
      type: Number,
      default: 0
    },
    isOnboardingCompleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function preSave(next) {
  const selectedCity = this.locationSelection?.city?.trim();
  const legacyCity = this.city?.trim();

  if (!selectedCity) {
    this.locationSelection = {
      ...(this.locationSelection || {}),
      city: legacyCity || 'Belirtilmedi'
    };
  }

  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.recomputeTrustScore = function recomputeTrustScore() {
  const completedDeals = Number(this.totalCompletedDeals || 0);
  const positive = Number(this.positiveReviews || 0);
  const negative = Number(this.negativeReviews || 0);
  const premiumBonus = this.isPremium ? 10 : 0;

  const score = 50 + completedDeals * 5 + positive * 3 - negative * 5 + premiumBonus;
  this.trustScore = Math.max(0, Math.min(100, score));
  return this.trustScore;
};

const User = mongoose.model('User', userSchema);

export default User;
