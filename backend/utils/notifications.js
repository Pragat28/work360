const Notification = require("../models/Notification");
const TimelineEvent = require("../models/TimelineEvent");
const User = require("../models/User");

// ─── Helper: fetch all HR Admin user IDs ──────────────────────────────────────
const getHrAdminIds = async () => {
  const hrAdmins = await User.find({ role: "hr_admin" }).select("_id");
  return hrAdmins.map((u) => u._id.toString());
};

// ─── createNotification ───────────────────────────────────────────────────────
// Creates the primary notification, optionally fires an email via emailFn,
// and auto-CCs all HR admins.
//
// `message` is what the primary `recipient` sees — often first-person
// ("You have been assigned..."). `hrMessage`, if provided, is what HR sees
// instead — third-person, audit-style ("X was assigned to..."). If omitted,
// HR falls back to the same `message` as the primary recipient.
//
// Usage:
//   await createNotification({
//     recipient: userId,
//     project: projectId,       // optional
//     subtask: subtaskId,       // optional
//     eventType: "subtask_completed",
//     message: "You have completed Final audit submission",
//     hrMessage: "Priya has completed Final audit submission", // optional
//     metadata: { stars: 4 },   // optional extra data
//     sendEmail: true,          // default true
//     emailFn: () => sendSubtaskCompletedEmail(...),  // optional mailer call
//   });
const createNotification = async ({
  recipient,
  project = null,
  subtask = null,
  eventType,
  message,
  hrMessage,
  metadata = {},
  sendEmail = true,
  emailFn = null,
}) => {
  let notification;
  try {
    notification = await Notification.create({
      recipient,
      project,
      subtask,
      eventType,
      message,
      metadata,
      emailSent: false,
    });
  } catch (err) {
    console.error(`createNotification error for ${eventType}:`, err.message);
    return; // don't attempt email or HR-CC if the primary notification failed
  }

  // ── Send email, if requested ────────────────────────────────────────────────
  if (sendEmail && emailFn) {
    try {
      await emailFn();
      notification.emailSent = true;
      notification.emailSentAt = new Date();
      await notification.save();
    } catch (emailErr) {
      console.error(`Email failed for event ${eventType}:`, emailErr.message);
    }
  }

  // ── Auto-CC all HR admins, skipping the original recipient if they're HR ────
  try {
    const hrAdminIds = await getHrAdminIds();
    const recipientStr = recipient?.toString();
    const ccIds = hrAdminIds.filter((id) => id !== recipientStr);

    if (ccIds.length) {
      await Notification.insertMany(
        ccIds.map((hrId) => ({
          recipient: hrId,
          project,
          subtask,
          eventType,
          message: hrMessage || message,
          metadata,
        }))
      );
    }
  } catch (err) {
    console.error(`createNotification HR-CC error for ${eventType}:`, err.message);
  }

  return notification;
};

// ─── createTimelineEvent ──────────────────────────────────────────────────────
// Call this from any controller to write an audit log entry.
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
    console.error(`createTimelineEvent error for ${eventType}:`, err.message);
  }
};

module.exports = { createNotification, createTimelineEvent };
