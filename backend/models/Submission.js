const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  versionNumber: {
    type: Number,
    default: 1
  },
  fileUrls: [String],
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'accepted', 'rejected', 'changes_requested'],
    default: 'draft'
  },
  managerRemark: {
    type: String,
    default: ''
  },

  // ADD 1: know who reviewed it and when
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

// ADD 2: auto-increment versionNumber per task before saving
submissionSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Submission').countDocuments({ task: this.task });
    this.versionNumber = count + 1;
  }
  next();
});

module.exports = mongoose.model('Submission', submissionSchema);