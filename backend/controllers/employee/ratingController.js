const Rating = require("../../models/Rating");
const Subtask = require("../../models/Subtask");
const Project = require("../../models/Project");
const User = require("../../models/User");

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Employee views the rating on one of their completed subtasks
// @route   GET /api/employee/subtasks/:id/rating
// @access  Employee only — can only see ratings on subtasks in their projects
// =============================================================================
exports.getMyRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "❌ Subtask not found" });
    }

    // Make sure the employee is actually on this project
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

    const rating = await Rating.findOne({
      subtask: subtask._id,
      isArchived: false,
    }).populate("ratedBy", "fullName");

    // Return null if not yet rated — not an error, just not rated yet
    return res.status(200).json({
      message: "✅ Rating fetched",
      rating: rating || null,
    });
  } catch (err) {
    console.error("getMyRating error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Employee views all ratings across all their subtasks
// @route   GET /api/employee/ratings
// @access  Employee only
// =============================================================================
exports.getAllMyRatings = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "❌ User not found" });

    const ratings = await Rating.find({
      employee: currentUser._id,
      isArchived: false,
    })
      .populate("subtask", "name dueDate completedAt")
      .populate("project", "title")
      .populate("ratedBy", "fullName")
      .sort({ createdAt: -1 });

    // Compute average
    const avg =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) * 10
          ) / 10
        : null;

    return res.status(200).json({
      message: "✅ Ratings fetched",
      count: ratings.length,
      averageRating: avg,
      ratings,
    });
  } catch (err) {
    console.error("getAllMyRatings error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};
