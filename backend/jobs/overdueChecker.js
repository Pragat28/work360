// jobs/overdueChecker.js
const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { subtaskOverdueEmail } = require("../config/emailTemplates");

const checkOverdueSubtasks = async () => {
  // 1. Find candidates (read-only — just to know who to notify).
  //    isCompleted: false is the real source of truth for "still open";
  //    status !== "overdue" just avoids re-notifying on every cron run.
  const overdueSubtasks = await Subtask.find({
    dueDate: { $lt: new Date() },
    isCompleted: false,
    isDeleted: false,
    status: { $ne: "overdue" },
  });

  for (const subtask of overdueSubtasks) {
    // 2. Atomic, conditional update — only flips to overdue if it STILL
    //    matches isCompleted:false at write-time. If a completeSubtask request
    //    landed in between, this update matches 0 documents and does nothing,
    //    so a subtask completed in this race window is never wrongly flagged.
    const updated = await Subtask.findOneAndUpdate(
      {
        _id: subtask._id,
        isCompleted: false,
        status: { $ne: "overdue" },
      },
      { $set: { status: "overdue" } },
      { new: true }
    );

    // 3. If updated is null, this subtask was completed in the race window —
    //    skip all notifications/emails for it entirely.
    if (!updated) continue;

    const project = await Project.findById(updated.project);
    if (!project) continue;

    const hrAdmins = await User.find({ role: "hr_admin" });
    const recipients = [...updated.assignedTo, ...hrAdmins.map((u) => u._id)];

    await Promise.all(
      recipients.map((userId) =>
        createNotification({
          recipient: userId,
          project: project._id,
          subtask: updated._id,
          eventType: "subtask_overdue",
          message: `"${updated.name}" in project "${project.title}" is now overdue. No action was taken before the deadline.`,
          metadata: { subtaskName: updated.name },
          ccHrAdmins: false
        })
      )
    );

    const employees = await User.find({ _id: { $in: updated.assignedTo } }).select("name email");
    employees.forEach((emp) => {
      const { subject, html } = subtaskOverdueEmail(emp.name, updated.name, project.title, updated.dueDate);
      transporter.sendMail({
        from: `"Work360" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
    });

    await createTimelineEvent({
      project: project._id,
      subtask: updated._id,
      actor: null,
      eventType: "subtask_overdue",
      description: `"${updated.name}" passed its deadline without being completed`,
      metadata: { dueDate: updated.dueDate },
    });
  }
};

module.exports = checkOverdueSubtasks;
