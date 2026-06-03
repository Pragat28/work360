const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quality:       { type: Number, min: 1, max: 5 },
  timeliness:    { type: Number, min: 1, max: 5 },
  communication: { type: Number, min: 1, max: 5 },
  overall:       { type: Number }
}, { timestamps: true });

ratingSchema.pre('save', function(next) {
  this.overall = +((this.quality + this.timeliness + this.communication) / 3).toFixed(1);
  next();
});

module.exports = mongoose.model('Rating', ratingSchema);