const Comment = require("../../models/Comment");
const Subtask = require("../../models/Subtask");
const Project = require("../../models/Project");
const User = require("../../models/User");

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Employee views comments on a subtask
// @route   GET /api/employee/subtasks/:id/comments
// @access  Employee only — read only, cannot post comments
// =============================================================================
exports.getComments = async (req, res) => {
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

    const comments = await Comment.find({
      subtask: subtask._id,
      isDeleted: false,
    })
      .populate("author", "name")          // ← was "fullName"
      .sort({ createdAt: 1 });

    return res.status(200).json({
      message: "✅ Comments fetched",
      count: comments.length,
      comments,
    });
  } catch (err) {
    console.error("getComments error:", err);
    return res.status(500).json({ message: "❌ Server error", error: err.message });
  }
};
