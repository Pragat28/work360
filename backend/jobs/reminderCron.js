const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { subtaskReminderEmail } = require("../config/emailTemplates");

// ─── Helper: send email fire-and-forget ──────────────────────────────────────
const sendMail = (to, subject, html) => {
  transporter.sendMail({
    from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  }).catch((err) => console.error(`[Cron] Email failed for ${to}:`, err.message));
};

// ─── Helper: whole days remaining until dueDate, counting from start of today ─
const daysUntil = (dueDate) => {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
};

// ─── Helper: was a reminder already sent today? ───────────────────────────────
const reminderSentToday = (reminderSentAt) => {
  if (!reminderSentAt) return false;
  const sent = new Date(reminderSentAt);
  const today = new Date();
  return (
    sent.getDate() === today.getDate() &&
    sent.getMonth() === today.getMonth() &&
    sent.getFullYear() === today.getFullYear()
  );
};

// =============================================================================
// Subtask Reminder — runs daily. For every open subtask, checks its project's
// notificationDays setting and sends a reminder once per day, starting from
// `notificationDays` days before the deadline through to the due date itself.
// =============================================================================

const subtaskReminder = async () => {
  console.log("[Cron] Running subtask reminder job...");

  try {
    const subtasks = await Subtask.find({
      isDeleted: false,
      isCompleted: false,
      status: { $ne: "completed" },
      assignedTo: { $exists: true, $not: { $size: 0 } },
    }).populate("project", "title notificationDays");

    let sentCount = 0;

    for (const subtask of subtasks) {
      if (!subtask.project) continue; // project may have been deleted

      const windowDays = subtask.project.notificationDays ?? 4;
      const remaining = daysUntil(subtask.dueDate);

      // Outside the reminder window: too early, or already past due
      // (overdueChecker.js handles past-due separately).
      if (remaining < 0 || remaining > windowDays) continue;

      // Already sent today — skip until tomorrow's run.
      if (reminderSentToday(subtask.reminderSentAt)) continue;

      const employees = await User.find({
        _id: { $in: subtask.assignedTo },
      }).select("name email");

      if (!employees.length) continue;

      const dayLabel =
        remaining === 0 ? "today" : remaining === 1 ? "in 1 day" : `in ${remaining} days`;

      for (const emp of employees) {
        await createNotification({
          recipient: emp._id,
          project: subtask.project._id,
          subtask: subtask._id,
          eventType: "subtask_reminder",
          message: `Reminder: "${subtask.name}" in project "${subtask.project.title}" is due ${dayLabel}.`,
          metadata: { dueDate: subtask.dueDate, daysRemaining: remaining },
        });

        const { subject, html } = subtaskReminderEmail(
          emp.name,
          subtask.name,
          subtask.project.title,
          remaining,
          subtask.dueDate
        );
        sendMail(emp.email, subject, html);
      }

      // Mark sent for today — one write per subtask, not per employee.
      await Subtask.findByIdAndUpdate(subtask._id, { reminderSentAt: new Date() });
      sentCount += 1;
    }

    console.log(`[Cron] Reminder job done. Reminders sent for ${sentCount} subtask(s).`);
  } catch (err) {
    console.error("[Cron] Reminder job error:", err.message);
  }
};

module.exports = subtaskReminder;
