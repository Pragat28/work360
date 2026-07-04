const SubtaskSubmission = require("../models/Submission");
const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");
const { createNotification, createTimelineEvent } = require("../utils/notifications");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Employee submits work for a subtask (upload files + note)
// @route   POST /api/subtasks/:id/submissions
// @access  Employee (must be assigned to the subtask)
// =============================================================================

exports.createSubmission = async (req, res) => {
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

    // Verify employee is assigned to this subtask
    const isAssigned = subtask.assignedTo.some(
      (id) => id.toString() === currentUser._id.toString()
    );
    if (!isAssigned) {
      return res.status(403).json({ message: "You are not assigned to this subtask" });
    }

    const project = await Project.findOne({
      _id: subtask.project,
      isDeleted: false,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Build files array from Cloudinary upload results (via multer middleware)
    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      cloudinaryUrl: file.path,
      cloudinaryPublicId: file.filename,
      fileType: file.mimetype,
      fileSize: file.size,
    }));

    if (!files.length && !req.body.note) {
      return res.status(400).json({ message: "Please provide at least a file or a note" });
    }

    const submission = await SubtaskSubmission.create({
      subtask: subtask._id,
      project: project._id,
      submittedBy: currentUser._id,
      note: req.body.note || "",
      files,
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_submission",
      description: `${currentUser.name} submitted work for subtask "${subtask.name}"`,
      metadata: { fileCount: files.length, hasNote: !!req.body.note },
    });

    // NOTE: createNotification auto-CCs all HR admins on every call —
    // do not add a manual HR notify loop here, it will double-notify HR.
    // Message is already third-person ("X submitted work..."), so it reads
    // correctly for HR as-is with no hrMessage override needed.
    const notifPromises = project.assignedManagers.map((managerId) =>
      createNotification({
        recipient: managerId,
        project: project._id,
        subtask: subtask._id,
        eventType: "subtask_submission",
        message: `${currentUser.name} submitted work for "${subtask.name}" in project "${project.title}".`,
        metadata: {
          employeeName: currentUser.name,
          subtaskName: subtask.name,
          fileCount: files.length,
        },
      })
    );
    await Promise.all(notifPromises);

    const populated = await SubtaskSubmission.findById(submission._id)
      .populate("submittedBy", "name email department");

    return res.status(201).json({ message: "Work submitted successfully", submission: populated });
  } catch (err) {
    console.error("createSubmission error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get all submissions for a subtask
// @route   GET /api/subtasks/:id/submissions
// @access  Manager (own projects), HR Admin, Employee (own submissions only)
// =============================================================================

exports.getSubmissions = async (req, res) => {
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

    const filter = { subtask: subtask._id, isDeleted: false };

    // Employees can only see their own submissions
    if (currentUser.role === "employee") {
      filter.submittedBy = currentUser._id;
    }

    const submissions = await SubtaskSubmission.find(filter)
      .populate("submittedBy", "name email department")
      .sort({ createdAt: -1 });

    return res.status(200).json({ submissions });
  } catch (err) {
    console.error("getSubmissions error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Delete a submission (soft delete, removes files from Cloudinary)
// @route   DELETE /api/submissions/:id
// @access  Employee (own submission only), HR Admin
// =============================================================================

exports.deleteSubmission = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const submission = await SubtaskSubmission.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Only the submitter or hr_admin can delete
    if (
      currentUser.role !== "hr_admin" &&
      submission.submittedBy.toString() !== currentUser._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorised to delete this submission" });
    }

    // Remove files from Cloudinary
    const deletePromises = submission.files.map((file) =>
      cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: "auto" })
    );
    await Promise.all(deletePromises);

    submission.isDeleted = true;
    submission.deletedAt = new Date();
    await submission.save();

    // NOTE: previously this looped hrAdminIds manually to notify HR.
    // createNotification now auto-CCs HR on every call, but there is no
    // longer a primary recipient here at all (the original code only ever
    // notified HR, with no manager/employee recipient). To preserve that
    // behaviour without double-notifying, send a single notification
    // straight to the actor's own HR-CC by calling createNotification with
    // recipient set to the actor — if the actor IS hr_admin, the wrapper's
    // self-exclusion means no notification is created at all here, which
    // matches "don't notify yourself about your own delete." If the actor
    // is NOT hr_admin (e.g. an edge case where this is reachable by another
    // role), the actor gets their own copy and HR is auto-CC'd as normal.
    await createNotification({
      recipient: currentUser._id,
      project: submission.project,
      subtask: submission.subtask,
      eventType: "subtask_submission",
      message: `${currentUser.name} deleted a submission.`,
      metadata: { submissionId: submission._id, actorId: currentUser._id },
    });

    return res.status(200).json({ message: "Submission deleted" });
  } catch (err) {
    console.error("deleteSubmission error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
