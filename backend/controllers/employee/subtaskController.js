const Subtask = require("../../models/Subtask");
const Project = require("../../models/Project");
const Rating = require("../../models/Rating");
const User = require("../../models/User");
const { createNotification, createTimelineEvent } = require("../../utils/notifications");
const transporter = require("../../config/emailConfig");
const { subtaskStartedEmail, subtaskCompletedEmail } = require("../../config/emailTemplates");

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

const getAssignedProject = async (projectId, employeeId) => {
  return Project.findOne({
    _id: projectId,
    isDeleted: false,
    assignedEmployees: employeeId,
  });
};

// ─── Helper: a task is only "late" once its due day has fully ended ──────────
const isPastDueDay = (referenceDate, dueDate) => {
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  return referenceDate > endOfDueDay;
};

// Helper: get manager + HR recipient list for a project (deduped)
const getNotifyRecipients = async (project) => {
  const hrAdmins = await User.find({ role: "hr_admin" }).select("_id name email");
  const managers = await User.find({ _id: { $in: project.assignedManagers } }).select("_id name email");
  const map = new Map();
  [...managers, ...hrAdmins].forEach((u) => map.set(u._id.toString(), u));
  return Array.from(map.values());
};

// =============================================================================
// @desc    Employee marks a subtask as started (allows late start)
// @route   PATCH /api/employee/subtasks/:id/start
// @access  Employee only
// =============================================================================
exports.startSubtask = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) return res.status(404).json({ message: "❌ Subtask not found" });

    const project = await getAssignedProject(subtask.project, currentUser._id);
    if (!project) {
      return res.status(403).json({ message: "❌ You are not assigned to this project" });
    }

    if (subtask.status === "completed" || subtask.isCompleted) {
      return res.status(400).json({ message: "❌ Cannot restart a completed subtask" });
    }

    subtask.status = "in_progress";
    subtask.startedAt = new Date();
    await subtask.save();

    const isLate = isPastDueDay(subtask.startedAt, subtask.dueDate);

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_started",
      description: isLate
        ? `${currentUser.name} started subtask "${subtask.name}" (late)`
        : `${currentUser.name} started subtask "${subtask.name}"`,
      metadata: { startedAt: subtask.startedAt, isLate },
    });

    const recipients = await getNotifyRecipients(project);
    const notifPromises = recipients.map((recipient) =>
      createNotification({
        recipient: recipient._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "subtask_started",
        message: isLate
          ? `${currentUser.name} has started "${subtask.name}" in project "${project.title}" — note: this is past the due date.`
          : `${currentUser.name} has started "${subtask.name}" in project "${project.title}".`,
        metadata: { employeeName: currentUser.name, subtaskName: subtask.name, isLate },
        emailFn: async () => {
          const { subject, html } = subtaskStartedEmail(
            recipient.name,
            currentUser.name,
            subtask.name,
            project.title,
            isLate
          );
          await transporter.sendMail({
            from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
            to: recipient.email,
            subject,
            html,
          });
        },
      })
    );
    await Promise.all(notifPromises);

    return res.status(200).json({
      message: isLate
        ? "⚠️ Subtask started (late — after due date)"
        : "✅ Subtask marked as started",
      subtask,
      isLate,
    });
  } catch (err) {
    console.error("startSubtask error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Employee marks a subtask as completed
// @route   PATCH /api/employee/subtasks/:id/complete
// @access  Employee only
// =============================================================================
exports.completeSubtask = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) return res.status(404).json({ message: "❌ Subtask not found" });

    const project = await getAssignedProject(subtask.project, currentUser._id);
    if (!project) {
      return res.status(403).json({ message: "❌ You are not assigned to this project" });
    }

    if (subtask.isCompleted) {
      return res.status(400).json({ message: "❌ Subtask is already completed" });
    }

    if (subtask.status === "pending") {
      return res.status(400).json({ message: "⚠️ Please start the subtask before marking it complete" });
    }

    const completedAt = new Date();
    const isLate = isPastDueDay(completedAt, subtask.dueDate);

    const updatedSubtask = await Subtask.findOneAndUpdate(
      { _id: subtask._id, isCompleted: false },
      { $set: { status: "completed", isCompleted: true, completedAt } },
      { new: true }
    );

    if (!updatedSubtask) {
      return res.status(400).json({ message: "❌ Subtask is already completed" });
    }

    await createTimelineEvent({
      project: subtask.project,
      subtask: updatedSubtask._id,
      actor: currentUser._id,
      eventType: "subtask_completed",
      description: isLate
        ? `${currentUser.name} completed subtask "${updatedSubtask.name}" (late)`
        : `${currentUser.name} completed subtask "${updatedSubtask.name}"`,
      metadata: { completedAt: updatedSubtask.completedAt, isLate },
    });

    const recipients = await getNotifyRecipients(project);
    const notifPromises = recipients.map((recipient) =>
      createNotification({
        recipient: recipient._id,
        project: project._id,
        subtask: updatedSubtask._id,
        eventType: "subtask_completed",
        message: isLate
          ? `${currentUser.name} has completed "${updatedSubtask.name}" in project "${project.title}" (late). Please log in to rate it.`
          : `${currentUser.name} has completed "${updatedSubtask.name}" in project "${project.title}". Please log in to rate it.`,
        metadata: { employeeName: currentUser.name, subtaskName: updatedSubtask.name, isLate },
        emailFn: async () => {
          const { subject, html } = subtaskCompletedEmail(
            recipient.name,
            currentUser.name,
            updatedSubtask.name,
            project.title,
            isLate
          );
          await transporter.sendMail({
            from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
            to: recipient.email,
            subject,
            html,
          });
        },
      })
    );
    await Promise.all(notifPromises);

    const allSubtasks = await Subtask.find({ project: project._id, isDeleted: false });
    const allCompleted = allSubtasks.every((st) =>
      st._id.toString() === updatedSubtask._id.toString() ? true : st.isCompleted
    );

    if (allCompleted) {
      await Project.findByIdAndUpdate(project._id, { status: "completed" });

      const avgRating = await Rating.aggregate([
        { $match: { project: project._id, isArchived: false } },
        { $group: { _id: null, avg: { $avg: "$stars" } } },
      ]);
      const avg = avgRating[0]?.avg?.toFixed(1) || "N/A";

      const projectCompletePromises = recipients.map((recipient) =>
        createNotification({
          recipient: recipient._id,
          project: project._id,
          eventType: "project_completed",
          message: `Project "${project.title}" is fully complete. Average rating: ${avg}/5.`,
          metadata: { avgRating: avg },
        })
      );
      await Promise.all(projectCompletePromises);
    }

    return res.status(200).json({
      message: isLate
        ? "⚠️ Subtask marked as completed (late — after due date)"
        : "✅ Subtask marked as completed",
      subtask: updatedSubtask,
      isLate,
    });
  } catch (err) {
    console.error("completeSubtask error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get rating for a specific subtask
// @route   GET /api/employee/subtasks/:id/rating
// @access  Employee only
// =============================================================================
exports.getSubtaskRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) {
      return res.status(404).json({ message: "❌ Subtask not found" });
    }

    const project = await getAssignedProject(subtask.project, currentUser._id);
    if (!project) {
      return res.status(403).json({ message: "❌ You are not assigned to this project" });
    }

    const rating = await Rating.findOne({ subtask: subtask._id, isArchived: false }).populate(
      "ratedBy",
      "name email role"
    );

    if (!rating) {
      return res.status(200).json({ message: "✅ No rating found", rating: null });
    }

    return res.status(200).json({ message: "✅ Rating fetched successfully", rating });
  } catch (err) {
    console.error("getSubtaskRating error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};
