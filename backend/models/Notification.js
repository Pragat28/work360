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
        "subtask_completed",
        "subtask_overdue",
        "subtask_reminder",
        "rating_submitted",
        "comment_posted",
        "project_completed",
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

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ project: 1 });
notificationSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);