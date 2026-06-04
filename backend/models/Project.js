const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "overdue"],
      default: "assigned",
    },

    assignedEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    assignedManagers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    notificationDays: {
      type: Number,
      default: 4,
      min: 1,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

projectSchema.index({ assignedEmployees: 1, isDeleted: 1 });
projectSchema.index({ assignedManagers: 1, isDeleted: 1 });
projectSchema.index({ status: 1, isDeleted: 1 });
projectSchema.index({ endDate: 1, isDeleted: 1 });

projectSchema.query.active = function () {
  return this.where({ isDeleted: false });
};

module.exports = mongoose.model("Project", projectSchema);