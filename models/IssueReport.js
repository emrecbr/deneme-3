import mongoose from 'mongoose';

const issueReportSchema = new mongoose.Schema(
  {
    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    relatedRfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      index: true
    },
    sourceType: {
      type: String,
      enum: ['rfq', 'profile'],
      required: true,
      index: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    roleRelation: {
      type: String,
      enum: ['buyer', 'seller', 'owner', 'other', 'self'],
      default: 'other'
    },
    category: {
      type: String,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['new', 'under_review', 'resolved', 'rejected', 'closed'],
      default: 'new',
      index: true
    },
    adminNotes: [
      {
        note: { type: String, trim: true },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    statusHistory: [
      {
        status: { type: String },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

issueReportSchema.index({ createdAt: -1 });

const IssueReport = mongoose.model('IssueReport', issueReportSchema);

export default IssueReport;
