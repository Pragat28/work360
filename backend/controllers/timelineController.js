const TimelineEvent = require("../models/Timelineevent");
const Project = require("../models/Project");
const User = require("../models/User");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: build a project filter scoped to the requesting user's role ──────
const getScopedProjectIds = async (user) => {
  const filter = { isDeleted: false };

  if (user.role === "employee") {
    filter.assignedEmployees = user._id;
  } else if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  // hr_admin: no additional filter — sees all projects

  const projects = await Project.find(filter).select("_id");
  return projects.map((p) => p._id);
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
// @desc    Get timeline events scoped to the requesting user's projects
//          — Employees  : only their assigned projects
//          — Managers   : only their assigned projects
//          — HR Admins  : all projects (global view)
// @route   GET /api/timeline
// @access  All roles
// =============================================================================

exports.getGlobalTimeline = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { eventType, projectId, limit = 50, page = 1 } = req.query;

    // ── Resolve the project IDs this user is allowed to see ──────────────────
    const allowedProjectIds = await getScopedProjectIds(currentUser);

    if (allowedProjectIds.length === 0) {
      return res.status(200).json({
        events: [],
        pagination: { total: 0, page: parseInt(page), pages: 0 },
      });
    }

    // ── Build filter ──────────────────────────────────────────────────────────
    const filter = { project: { $in: allowedProjectIds } };

    if (eventType) filter.eventType = eventType;

    // If a specific projectId is requested, honour it only if it's within scope
    if (projectId) {
      const isAllowed = allowedProjectIds
        .map((id) => id.toString())
        .includes(projectId);

      if (!isAllowed) {
        return res.status(403).json({ message: "Access to this project is not allowed" });
      }
      filter.project = projectId;
    }

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
