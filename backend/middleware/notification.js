const Notification = require("../models/Notification");
const TimelineEvent = require("../models/TimelineEvent");

// ─── createNotification ───────────────────────────────────────────────────────
// Call this from any controller whenever a notifiable event happens.
// It writes the Notification record and marks emailSent when the mailer succeeds.
//
// Usage:
//   await createNotification({
//     recipient: userId,
//     project: projectId,       // optional
//     subtask: subtaskId,       // optional
//     eventType: "subtask_completed",
//     message: "Priya has completed Final audit submission",
//     metadata: { stars: 4 },   // optional extra data
//     sendEmail: true,          // default true
//     emailFn: () => sendSubtaskCompletedEmail(...),  // the actual mailer call
//   });

const createNotification = async ({
  recipient,
  project = null,
  subtask = null,
  eventType,
  message,
  metadata = {},
  sendEmail = true,
  emailFn = null,
}) => {
  const notification = await Notification.create({
    recipient,
    project,
    subtask,
    eventType,
    message,
    metadata,
    emailSent: false,
  });

  if (sendEmail && emailFn) {
    try {
      await emailFn();
      notification.emailSent = true;
      notification.emailSentAt = new Date();
      await notification.save();
    } catch (emailErr) {
      // Email failure should never crash the main request.
      // The notification record is already saved — it will show in-app
      // even if the email didn't go out. Log for debugging.
      console.error(`Email failed for event ${eventType}:`, emailErr.message);
    }
  }

  return notification;
};

// ─── createTimelineEvent ──────────────────────────────────────────────────────
// Call this from any controller to write an audit log entry.
// Every significant action in your scope needs one of these.
//
// Usage:
//   await createTimelineEvent({
//     project: projectId,
//     subtask: subtaskId,       // optional
//     actor: req.user._id,
//     eventType: "subtask_completed",
//     description: "Priya Sharma completed Final audit submission",
//     metadata: { from: "in_progress", to: "completed" },
//   });

const createTimelineEvent = async ({
  project,
  subtask = null,
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
    // Timeline write failures should never crash the main request.
    console.error(`Timeline event write failed for ${eventType}:`, err.message);
  }
};

module.exports = { createNotification, createTimelineEvent };