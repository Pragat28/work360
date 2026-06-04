const mongoose = require("mongoose");

const subtaskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    name: {
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

    dueDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "overdue"],
      default: "pending",
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    order: {
      type: Number,
      default: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    reminderSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

subtaskSchema.index({ project: 1, isDeleted: 1, order: 1 });
subtaskSchema.index({ dueDate: 1, status: 1, isDeleted: 1 });
subtaskSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model("Subtask", subtaskSchema);