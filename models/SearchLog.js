import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema(
  {
    term: {
      type: String,
      required: true,
      trim: true
    },
    normalizedTerm: {
      type: String,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    suggestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SearchSuggestion'
    },
    source: {
      type: String,
      enum: ['manual', 'suggestion'],
      default: 'manual'
    },
    resultsCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

searchLogSchema.index({ normalizedTerm: 1, createdAt: -1 });
searchLogSchema.index({ createdAt: -1 });

const SearchLog = mongoose.model('SearchLog', searchLogSchema);

export default SearchLog;
