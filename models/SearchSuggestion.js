import mongoose from 'mongoose';

const searchSuggestionSchema = new mongoose.Schema(
  {
    term: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

searchSuggestionSchema.index({ term: 1 });
searchSuggestionSchema.index({ order: 1 });

const SearchSuggestion = mongoose.model('SearchSuggestion', searchSuggestionSchema);

export default SearchSuggestion;
