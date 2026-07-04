const TimelineEvent = require("../models/Timelineevent");
const Project = require("../models/Project");
const User = require("../models/User");
const Subtask = require("../models/Subtask");
const Rating = require("../models/Rating");


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
      .populate("actor", "name role")
      .populate("subtask", "name status")
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

    const { eventType, projectId, actorRole, limit = 50, page = 1 } = req.query;

    // ── Resolve scoped project IDs ────────────────────────────────────────────
    const allowedProjectIds = await getScopedProjectIds(currentUser);

    if (allowedProjectIds.length === 0) {
      return res.status(200).json({
        events: [],
        pagination: { total: 0, page: parseInt(page), pages: 0 },
      });
    }

    // ── Resolve the effective project scope BEFORE mutating filter.project,
    //    so the subtask_overdue lookup below always has a clean array to
    //    work with regardless of whether projectId narrowed it down ────────
    let effectiveProjectScope = allowedProjectIds;

    // ── Base filter ───────────────────────────────────────────────────────────
    const filter = { project: { $in: allowedProjectIds } };

    if (projectId) {
      const isAllowed = allowedProjectIds.map((id) => id.toString()).includes(projectId);
      if (!isAllowed) {
        return res.status(403).json({ message: "Access to this project is not allowed" });
      }
      filter.project = projectId;
      effectiveProjectScope = [projectId];
    }

    // ── actorRole filter (HR-specific) ────────────────────────────────────────
    // We need to match against the actor's role field stored on the User model.
    // Strategy: pre-resolve matching user IDs, then filter by actor.
    if (actorRole) {
      const matchingUsers = await User.find({ role: actorRole }).select("_id");
      const matchingIds = matchingUsers.map((u) => u._id);
      filter.actor = { $in: matchingIds };
    }

    // ── eventType filter — special-cased for "subtask_overdue" ─────────────
    //    The subtask_overdue eventType isn't reliably logged when a subtask
    //    goes overdue, so filtering on the stored eventType field misses
    //    real overdue subtasks. When HR picks "Overdue" in the dropdown,
    //    instead resolve subtasks whose LIVE status is currently "overdue"
    //    and return the events attached to those subtasks. Every other
    //    eventType filters normally by the stored field. ────────────────────
    if (eventType === "subtask_overdue") {
      const overdueSubtasks = await Subtask.find({
        project: { $in: effectiveProjectScope },
        isDeleted: false,
        status: "overdue",
      }).select("_id");
      filter.subtask = { $in: overdueSubtasks.map((s) => s._id) };
    } else if (eventType) {
      filter.eventType = eventType;
    }

    // ── Paginate ──────────────────────────────────────────────────────────────
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [events, total] = await Promise.all([
      TimelineEvent.find(filter)
        .populate("actor", "name role")
        .populate("project", "title")
        .populate("subtask", "name status")
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

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

exports.getExportData = async (req, res) => {
  try {
    const { projectId, mode } = req.query; // mode: "overdue" | "activity"

    const filter = { isDeleted: false };
    if (projectId && projectId !== "all") filter.project = projectId;
    if (mode === "overdue") filter.status = "overdue";

    const subtasks = await Subtask.find(filter)
      .populate("assignedTo", "name")
      .populate({
        path: "project",
        select: "title assignedManagers",
        populate: { path: "assignedManagers", select: "name" },
      })
      .sort({ dueDate: 1 })
      .lean();

    const subtaskIds = subtasks.map((st) => st._id);
    const ratings = await Rating.find({ subtask: { $in: subtaskIds }, isArchived: false }).lean();
    const ratingMap = new Map(ratings.map((r) => [String(r.subtask), r]));

    const rows = subtasks.map((st) => {
      const rating = ratingMap.get(String(st._id));

      return {
        "Project Name": st.project?.title || "—",
        "Subtask Name": st.name || "—",
        "Assigned Employee":
          st.assignedTo?.map((u) => u.name).filter(Boolean).join(", ") || "Unassigned",
        "Assigned Manager":
          st.project?.assignedManagers?.map((u) => u.name).filter(Boolean).join(", ") ||
          "None Assigned",
        "Starting Date": formatDate(st.startDate),
        "Due Date": formatDate(st.dueDate),
        "Status": st.status.replace("_", " ").toUpperCase(),
        "Completion Date": st.completedAt
          ? formatDate(st.completedAt)
          : st.isCompleted
          ? "Completed"
          : "Not Completed",
        "Rating": rating ? `${rating.stars} Stars` : "No Rating",
      };
    });

    res.json({ rows });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: err.message || "Failed to generate export" });
  }
};

// =============================================================================
// @desc    Get LIVE aggregate stats (not paginated event counts) — total
//          subtasks, completions, currently-overdue subtasks, and average
//          rating, scoped to the requesting user's role and optionally a
//          single project. This intentionally queries Subtask/Rating
//          directly rather than TimelineEvent, since these numbers must
//          reflect current real-world state, not "how many events of this
//          type happened to load on this page."
// @route   GET /api/timeline/stats?projectId=<id|omit for all-in-scope>
// @access  All roles (scoped the same way as getGlobalTimeline)
// =============================================================================

exports.getTimelineStats = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { projectId } = req.query;

    // ── Resolve scoped project IDs (same scoping rules as the event list) ────
    const allowedProjectIds = await getScopedProjectIds(currentUser);

    if (allowedProjectIds.length === 0) {
      return res.status(200).json({
        totalSubtasks: 0,
        completedSubtasks: 0,
        overdueSubtasks: 0,
        avgRating: null,
        ratingCount: 0,
      });
    }

    let projectScope = allowedProjectIds;

    if (projectId && projectId !== "all") {
      const isAllowed = allowedProjectIds.map((id) => id.toString()).includes(projectId);
      if (!isAllowed) {
        return res.status(403).json({ message: "Access to this project is not allowed" });
      }
      projectScope = [projectId];
    }

    const subtaskFilter = { project: { $in: projectScope }, isDeleted: false };
    const now = new Date();

    const [totalSubtasks, completedSubtasks, overdueSubtasks] = await Promise.all([
      Subtask.countDocuments(subtaskFilter),
      Subtask.countDocuments({ ...subtaskFilter, status: "completed" }),
      // Live overdue: due date has passed and it isn't marked completed —
      // computed on the fly rather than trusting a stored "overdue" status,
      // so this is always accurate regardless of when any cron job last ran.
      Subtask.countDocuments({
        ...subtaskFilter,
        status: { $ne: "completed" },
        dueDate: { $lt: now },
      }),
    ]);

    const Rating = require("../models/Rating");
    const mongoose = require("mongoose");

    // ── IMPORTANT: aggregate() pipelines are NOT schema-cast by Mongoose the
    // way find()/countDocuments() are. When projectScope came from a plain
    // req.query string (the single-project-filter case), it's a raw string,
    // not an ObjectId — $match against an ObjectId field would silently
    // match nothing. Cast explicitly here regardless of which branch set
    // projectScope, so this stays correct in both the "all projects" and
    // "single project" cases.
    const ratingProjectScope = projectScope.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const ratingAgg = await Rating.aggregate([
      {
        $match: {
          project: { $in: ratingProjectScope },
          isArchived: false,
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: "$stars" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRating = ratingAgg.length ? Math.round(ratingAgg[0].avg * 10) / 10 : null;
    const ratingCount = ratingAgg.length ? ratingAgg[0].count : 0;

    return res.status(200).json({
      totalSubtasks,
      completedSubtasks,
      overdueSubtasks,
      avgRating,
      ratingCount,
    });
  } catch (err) {
    console.error("getTimelineStats error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
