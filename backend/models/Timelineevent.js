const mongoose = require("mongoose");

const timelineEventSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    subtask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtask",
      default: null,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null, // null for system-generated events (like overdue)
    },

    eventType: {
      type: String,
      enum: [
        "project_created",
        "project_edited",
        "project_deleted",
        "subtask_created",
        "subtask_started",
        "subtask_completed",
        "subtask_overdue",
        "subtask_submission",
        "subtask_edited",
        "subtask_deleted",
        "subtask_assigned",
        "rating_submitted",
        "rating_updated",
        "comment_posted",
        "comment_deleted",
        "employee_added",
        "employee_removed",
        "manager_added",
        "manager_removed",
        "status_changed",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

timelineEventSchema.index({ project: 1, createdAt: -1 });
timelineEventSchema.index({ actor: 1, createdAt: -1 });
timelineEventSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model("TimelineEvent", timelineEventSchema);
