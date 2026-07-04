const SubtaskSubmission = require("../../models/Submission");
const Subtask = require("../../models/Subtask");
const Project = require("../../models/Project");
const User = require("../../models/User");
const { cloudinary } = require("../../config/cloudinary");
const { createNotification, createTimelineEvent } = require("../../utils/notifications");
const transporter = require("../../config/emailConfig");
const { subtaskSubmissionEmail } = require("../../config/emailTemplates");

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
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
// @desc    Employee submits work for a subtask (files + optional note)
// @route   POST /api/employee/subtasks/:id/submissions
// @access  Employee only
// @note    Allows late submissions — marks isLate if submitted after dueDate
// =============================================================================
exports.createSubmission = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) {
      return res.status(404).json({ message: "❌ Subtask not found" });
    }

    const project = await Project.findOne({
      _id: subtask.project,
      assignedEmployees: currentUser._id,
      isDeleted: false,
    });
    if (!project) {
      return res.status(403).json({
        message: "❌ You are not assigned to the project this subtask belongs to",
      });
    }

    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      cloudinaryUrl: file.path,
      cloudinaryPublicId: file.filename,
      fileType: file.mimetype,
      fileSize: file.size,
    }));

    if (!files.length && !req.body.note) {
      return res.status(400).json({
        message: "❌ Please provide at least a file or a note before submitting",
      });
    }

    // Check if submission is late (after dueDate)
    const isLate = new Date() > new Date(subtask.dueDate);

    const submission = await SubtaskSubmission.create({
      subtask: subtask._id,
      project: project._id,
      submittedBy: currentUser._id,
      note: req.body.note || "",
      isLate,
      files,
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_submission",
      description: `${currentUser.name} submitted work for subtask "${subtask.name}"${isLate ? " (late)" : ""}`,
      metadata: { fileCount: files.length, hasNote: !!req.body.note, isLate },
    });

    const recipients = await getNotifyRecipients(project);
    const notifPromises = recipients.map((recipient) =>
      createNotification({
        recipient: recipient._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "subtask_submission",
        message: `${currentUser.name} submitted work for "${subtask.name}" in project "${project.title}"${isLate ? " — submitted late" : ""}.`,
        metadata: {
          employeeName: currentUser.name,
          subtaskName: subtask.name,
          fileCount: files.length,
          isLate,
        },
        emailFn: async () => {
          const { subject, html } = subtaskSubmissionEmail(
            recipient.name,
            currentUser.name,
            subtask.name,
            project.title,
            files.length,
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

    const populated = await SubtaskSubmission.findById(submission._id).populate(
      "submittedBy",
      "name email department"
    );

    return res.status(201).json({
      message: isLate
        ? "⚠️ Work submitted — marked as late since the due date has passed"
        : "✅ Work submitted successfully",
      submission: populated,
    });
  } catch (err) {
    console.error("createSubmission error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get employee's own submissions for a subtask
// @route   GET /api/employee/subtasks/:id/submissions
// @access  Employee only
// =============================================================================
exports.getMySubmissions = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) {
      return res.status(404).json({ message: "❌ Subtask not found" });
    }

    const submissions = await SubtaskSubmission.find({
      subtask: subtask._id,
      submittedBy: currentUser._id,
      isDeleted: false,
    })
      .populate("submittedBy", "name email department")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "✅ Submissions fetched successfully",
      submissions,
    });
  } catch (err) {
    console.error("getMySubmissions error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Employee deletes their own submission
// @route   DELETE /api/employee/submissions/:id
// @access  Employee only (own submissions)
// =============================================================================
exports.deleteSubmission = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const submission = await SubtaskSubmission.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!submission) {
      return res.status(404).json({ message: "❌ Submission not found" });
    }

    if (submission.submittedBy.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        message: "❌ You can only delete your own submissions",
      });
    }

    const deletePromises = submission.files.map((file) =>
      cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: "auto" })
    );
    await Promise.all(deletePromises);

    submission.isDeleted = true;
    submission.deletedAt = new Date();
    await submission.save();

    return res.status(200).json({ message: "✅ Submission deleted successfully" });
  } catch (err) {
    console.error("deleteSubmission error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};
