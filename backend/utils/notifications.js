const Notification = require("../models/Notification");
const TimelineEvent = require("../models/Timelineevent");

// ─── Create a notification ────────────────────────────────────────────────────
const createNotification = async ({
  recipient,
  project,
  subtask,
  eventType,
  message,
  metadata = {},
}) => {
  try {
    await Notification.create({
      recipient,
      project,
      subtask,
      eventType,
      message,
      metadata,
    });
  } catch (err) {
    console.error("createNotification error:", err.message);
  }
};

// ─── Create a timeline event ──────────────────────────────────────────────────
const createTimelineEvent = async ({
  project,
  subtask,
  actor,
  eventType,
  description,
  metadata = {},
}) => {
  try {
    await TimelineEvent.create({
      project,
      subtask,
      actor,
      eventType,
      description,
      metadata,
    });
  } catch (err) {
    console.error("createTimelineEvent error:", err.message);
  }
};

module.exports = { createNotification, createTimelineEvent };