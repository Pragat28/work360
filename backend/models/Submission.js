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
  }
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);