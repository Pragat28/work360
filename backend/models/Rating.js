const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    subtask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtask",
      required: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    // All employees assigned to the subtask at the time of rating
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ratedByRole: {
      type: String,
      enum: ["manager", "hr_admin"],
      required: true,
    },

    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    remark: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    updatedCount: {
      type: Number,
      default: 0,
    },

    previousStars: {
      type: Number,
      default: null,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One rating document per subtask — unique index stays as-is
ratingSchema.index({ subtask: 1 }, { unique: true });
ratingSchema.index({ project: 1, isArchived: 1 });
ratingSchema.index({ employees: 1, isArchived: 1 }); // updated from employee → employees
ratingSchema.index({ ratedBy: 1 });

module.exports = mongoose.model("Rating", ratingSchema);
