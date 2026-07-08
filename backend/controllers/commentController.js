const Comment = require("../models/Comment");
const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { remarkPostedEmail } = require("../config/emailTemplates");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: verify the user can see this subtask's project ──────────────────
const getAccessibleProject = async (projectId, user) => {
  const filter = { _id: projectId, isDeleted: false };
  if (user.role === "employee") {
    filter.assignedEmployees = user._id;
  } else if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  return Project.findOne(filter);
};

// =============================================================================
// @desc    Get all comments for a subtask
// @route   GET /api/subtasks/:id/comments
// @access  All roles (scoped — must be on the project)
// =============================================================================

exports.getComments = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const project = await getAccessibleProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to view this subtask" });
    }

    const comments = await Comment.find({
      subtask: subtask._id,
      isDeleted: false,
    })
      .populate("author", "name email")
      .sort({ createdAt: 1 });

    return res.status(200).json({ comments });
  } catch (err) {
    console.error("getComments error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Post a comment on a subtask
// @route   POST /api/subtasks/:id/comments
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.addComment = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    // Manager can only comment on projects they manage
    const filter = { _id: subtask.project, isDeleted: false };
    if (currentUser.role === "manager") {
      filter.assignedManagers = currentUser._id;
    }
    const project = await Project.findOne(filter);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to comment on this subtask" });
    }

    const comment = await Comment.create({
      subtask: subtask._id,
      project: project._id,
      author: currentUser._id,
      authorRole: currentUser.role,
      text: text.trim(),
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "comment_posted",
      description: `${currentUser.name} posted a remark on "${subtask.name}"`,
      metadata: { commentId: comment._id },
    });

    const trimmedText = text.trim();
    const preview = `${trimmedText.substring(0, 100)}${trimmedText.length > 100 ? "..." : ""}`;

    // Notify all assigned employees — createNotification auto-CCs HR on each
    // call, so no separate HR loop needed here
    const employees = await User.find({
      _id: { $in: project.assignedEmployees },
    }).select("name email");

    const notifPromises = employees.map((emp) =>
      createNotification({
        recipient: emp._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "comment_posted",
        message: `${currentUser.name} left a remark on "${subtask.name}": "${preview}"`,
        hrMessage: `${currentUser.name} left a remark on "${subtask.name}" in project "${project.title}" for ${emp.name}: "${preview}"`,
        metadata: {
          commentId: comment._id,
          authorName: currentUser.name,
          subtaskName: subtask.name,
        },
      })
    );
    await Promise.all(notifPromises);

    // ── Notify project managers too — createNotification only auto-CCs HR,
    // not managers, so without this loop a manager who isn't the comment's
    // author never hears about it (e.g. HR commented, or a co-manager did).
    const populatedProject = await Project.findById(project._id).populate("assignedManagers", "name email");
    const managersToNotify = populatedProject.assignedManagers.filter(
      (mgr) => mgr._id.toString() !== currentUser._id.toString()
    );

    const managerNotifPromises = managersToNotify.map((mgr) =>
      createNotification({
        recipient: mgr._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "comment_posted",
        message: `${currentUser.name} left a remark on "${subtask.name}": "${preview}"`,
        metadata: {
          commentId: comment._id,
          authorName: currentUser.name,
          subtaskName: subtask.name,
        },
        sendEmail: false, // email is going to employees only; managers get in-app only
        ccHrAdmins: false, // HR already covered by the employee notification loop above
      })
    );
    await Promise.all(managerNotifPromises);

    // Email each assigned employee — direct transporter call, fire-and-forget
    employees.forEach((emp) => {
      const { subject, html } = remarkPostedEmail(
        emp.name,
        currentUser.name,
        subtask.name,
        trimmedText
      );
      transporter.sendMail({
        from: `"Work360" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
    });

    const populated = await Comment.findById(comment._id).populate(
      "author",
      "name email"
    );

    return res.status(201).json({ message: "Comment posted", comment: populated });
  } catch (err) {
    console.error("addComment error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Author (manager deletes own), HR Admin (deletes any)
// =============================================================================

exports.deleteComment = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const comment = await Comment.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Managers can only delete their own comments
    if (
      currentUser.role === "manager" &&
      comment.author.toString() !== currentUser._id.toString()
    ) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedBy = currentUser._id;
    await comment.save();

    await createTimelineEvent({
      project: comment.project,
      subtask: comment.subtask,
      actor: currentUser._id,
      eventType: "comment_deleted",
      description: `${currentUser.name} deleted a remark on a subtask`,
      metadata: { commentId: comment._id },
    });

    // Single createNotification to the actor — if actor is hr_admin the
    // self-exclusion inside createNotification means no doc is created, which
    // correctly avoids self-notifying. If actor is manager, HR gets auto-CC'd
    // as normal. Mirrors the deleteSubmission pattern exactly.
    await createNotification({
      recipient: currentUser._id,
      project: comment.project,
      subtask: comment.subtask,
      eventType: "comment_deleted",
      message: `${currentUser.name} deleted a remark on a subtask.`,
      hrMessage: `${currentUser.name} deleted a remark on subtask in project — comment ID: ${comment._id}.`,
      metadata: { commentId: comment._id, actorId: currentUser._id },
    });

    return res.status(200).json({ message: "Comment deleted" });
  } catch (err) {
    console.error("deleteComment error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
