const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    subtask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtask",
      default: null,
    },

    eventType: {
      type: String,
      enum: [
        "project_assigned",
        "employee_added",
        "employee_removed",
        "manager_added",
        "manager_removed",
        "subtask_started",
        "subtask_submission", // Explicitly documented in second version
        "subtask_completed",
        "subtask_overdue",
        "subtask_reminder",
        "subtask_assigned",
        "rating_submitted",
        "comment_posted",
        "project_completed",
        "project_deleted",
        "project_created",
        "project_edited",
        "role_assigned",
        "role_changed",
        "account_locked",
        "password_reset",
      ],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Performance Compound Indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ project: 1 });
notificationSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
