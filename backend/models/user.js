const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['employee', 'manager', 'hr_admin', 'pending'],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationTokenExpire: {
    type: Date
  },
  verificationToken: {
    type: String
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpire: {
    type: Date
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  department: {
    type: String,
    default: ''
  },
  departmentUpdatedAt: { type: Date, default: Date.now },
  departmentReminderSent: {
    sevenDay: { type: Boolean, default: false },
    threeDay: { type: Boolean, default: false },
    oneDay: { type: Boolean, default: false }
  },
  reportSentAt: {       // ✅ Tracks when 3-month report was sent
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
