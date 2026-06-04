const TimelineEvent = require("../models/Timelineevent");
const Project = require("../models/Project");
const User = require("../models/User");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Get all timeline events for a specific project
// @route   GET /api/projects/:id/timeline
// @access  All roles (scoped — must be on the project)
// =============================================================================

exports.getProjectTimeline = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const scopeFilter = { _id: req.params.id, isDeleted: false };
    if (currentUser.role === "employee") {
      scopeFilter.assignedEmployees = currentUser._id;
    } else if (currentUser.role === "manager") {
      scopeFilter.assignedManagers = currentUser._id;
    }

    const project = await Project.findOne(scopeFilter);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const events = await TimelineEvent.find({ project: project._id })
      .populate("actor", "fullName role")
      .populate("subtask", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ events });
  } catch (err) {
    console.error("getProjectTimeline error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get all timeline events across all projects
// @route   GET /api/timeline
// @access  HR Admin only
// =============================================================================

exports.getGlobalTimeline = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { eventType, projectId, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (projectId) filter.project = projectId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [events, total] = await Promise.all([
      TimelineEvent.find(filter)
        .populate("actor", "fullName role")
        .populate("project", "title")
        .populate("subtask", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TimelineEvent.countDocuments(filter),
    ]);

    return res.status(200).json({
      events,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("getGlobalTimeline error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};