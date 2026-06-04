const Rating = require("../models/Rating");
const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: verify manager/admin can access this project ────────────────────
const getEditableProject = async (projectId, user) => {
  const filter = { _id: projectId, isDeleted: false };
  if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  return Project.findOne(filter);
};

// =============================================================================
// @desc    Submit a rating for a completed subtask
// @route   POST /api/subtasks/:id/rating
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.submitRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { stars, remark } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ message: "stars must be a number between 1 and 5" });
    }

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    if (subtask.status !== "completed") {
      return res.status(400).json({
        message: "Subtask must be completed before it can be rated",
      });
    }

    const existing = await Rating.findOne({ subtask: subtask._id });
    if (existing) {
      return res.status(400).json({
        message: "This subtask has already been rated. Use PATCH to update it.",
      });
    }

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to rate this subtask" });
    }

    if (!subtask.completedBy) {
      return res.status(400).json({
        message: "Cannot determine which employee completed this subtask",
      });
    }

    const rating = await Rating.create({
      subtask: subtask._id,
      project: project._id,
      employee: subtask.completedBy,
      ratedBy: currentUser._id,
      ratedByRole: currentUser.role,
      stars: parseInt(stars),
      remark: remark?.trim() || "",
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "rating_submitted",
      description: `${currentUser.fullName} rated "${subtask.name}" ${stars}/5`,
      metadata: { stars, remark: remark || "" },
    });

    await createNotification({
      recipient: subtask.completedBy,
      project: project._id,
      subtask: subtask._id,
      eventType: "rating_submitted",
      message: `Your work on "${subtask.name}" has been rated ${stars}/5 by ${currentUser.fullName}.${remark ? ` Remarks: "${remark}"` : ""}`,
      metadata: {
        stars,
        remark: remark || "",
        ratedByName: currentUser.fullName,
        subtaskName: subtask.name,
      },
    });

    const populated = await Rating.findById(rating._id)
      .populate("ratedBy", "fullName")
      .populate("employee", "fullName");

    return res.status(201).json({ message: "Rating submitted", rating: populated });
  } catch (err) {
    console.error("submitRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Update an existing rating
// @route   PATCH /api/subtasks/:id/rating
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.updateRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { stars, remark } = req.body;

    if (stars !== undefined && (stars < 1 || stars > 5)) {
      return res.status(400).json({ message: "stars must be a number between 1 and 5" });
    }

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to update this rating" });
    }

    const rating = await Rating.findOne({
      subtask: subtask._id,
      isArchived: false,
    });
    if (!rating) {
      return res.status(404).json({
        message: "No rating found for this subtask. Use POST to submit one.",
      });
    }

    const previousStars = rating.stars;

    if (stars !== undefined) {
      rating.previousStars = previousStars;
      rating.stars = parseInt(stars);
    }
    if (remark !== undefined) {
      rating.remark = remark.trim();
    }
    rating.updatedCount += 1;

    await rating.save();

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "rating_updated",
      description: `${currentUser.fullName} updated rating on "${subtask.name}" from ${previousStars}/5 to ${rating.stars}/5`,
      metadata: { previousStars, newStars: rating.stars, remark: remark || "" },
    });

    await createNotification({
      recipient: rating.employee,
      project: project._id,
      subtask: subtask._id,
      eventType: "rating_submitted",
      message: `Your rating on "${subtask.name}" has been updated to ${rating.stars}/5 by ${currentUser.fullName}.${rating.remark ? ` Remarks: "${rating.remark}"` : ""}`,
      metadata: {
        stars: rating.stars,
        previousStars,
        ratedByName: currentUser.fullName,
      },
    });

    const populated = await Rating.findById(rating._id)
      .populate("ratedBy", "fullName")
      .populate("employee", "fullName");

    return res.status(200).json({ message: "Rating updated", rating: populated });
  } catch (err) {
    console.error("updateRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get the rating for a subtask
// @route   GET /api/subtasks/:id/rating
// @access  All roles (scoped — must be on the project)
// =============================================================================

exports.getRating = async (req, res) => {
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

    const scopeFilter = { _id: subtask.project, isDeleted: false };
    if (currentUser.role === "employee") {
      scopeFilter.assignedEmployees = currentUser._id;
    } else if (currentUser.role === "manager") {
      scopeFilter.assignedManagers = currentUser._id;
    }

    const project = await Project.findOne(scopeFilter);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to view this rating" });
    }

    const rating = await Rating.findOne({
      subtask: subtask._id,
      isArchived: false,
    })
      .populate("ratedBy", "fullName")
      .populate("employee", "fullName");

    return res.status(200).json({ rating: rating || null });
  } catch (err) {
    console.error("getRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};