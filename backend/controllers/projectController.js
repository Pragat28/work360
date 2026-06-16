const Project = require("../models/Project");
const Subtask = require("../models/Subtask");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: build role-scoped project filter ─────────────────────────────────
const getScopeFilter = (user) => {
  if (user.role === "employee") {
    return { assignedEmployees: user._id, isDeleted: false };
  }
  if (user.role === "manager") {
    return { assignedManagers: user._id, isDeleted: false };
  }
  return { isDeleted: false };
};

// ─── Helper: attach progress to projects ─────────────────────────────────────
const getProgressMap = async (projectIds) => {
  const subtasks = await Subtask.find({
    project: { $in: projectIds },
    isDeleted: false,
  }).select("project status");

  const map = {};
  for (const st of subtasks) {
    const pid = st.project.toString();
    if (!map[pid]) map[pid] = { total: 0, completed: 0 };
    map[pid].total += 1;
    if (st.status === "completed") map[pid].completed += 1;
  }

  for (const pid in map) {
    const { total, completed } = map[pid];
    map[pid].percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  }

  return map;
};

// ─── Helper: attach avg rating to projects ────────────────────────────────────
const getRatingMap = async (projectIds) => {
  const Rating = require("../models/Rating");
  const ratings = await Rating.find({
    project: { $in: projectIds },
    isArchived: false,
  }).select("project stars");

  const map = {};
  for (const r of ratings) {
    const pid = r.project.toString();
    if (!map[pid]) map[pid] = { total: 0, sum: 0 };
    map[pid].total += 1;
    map[pid].sum += r.stars;
  }

  for (const pid in map) {
    const { total, sum } = map[pid];
    map[pid].avg = total === 0 ? null : Math.round((sum / total) * 10) / 10;
  }

  return map;
};

// =============================================================================
// @desc    Search users by name / email / department (for assignment pickers)
// @route   GET /api/projects/search-users?role=employee&q=John
// @access  Manager (employee search only), HR Admin (all roles)
// =============================================================================

exports.searchUsers = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { q = "", role } = req.query;

    // Managers may only search for employees
    if (currentUser.role === "manager" && role && role !== "employee") {
      return res.status(403).json({ message: "Managers can only search for employees" });
    }

    // Build role filter
    let roleFilter;
    if (currentUser.role === "manager") {
      roleFilter = "employee";
    } else {
      roleFilter = role && ["employee", "manager"].includes(role) ? role : null;
    }

    const filter = {};

    if (roleFilter) {
      filter.role = roleFilter;
    } else {
      filter.role = { $in: ["employee", "manager"] };
    }

    if (q.trim()) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { email: { $regex: q.trim(), $options: "i" } },
        { department: { $regex: q.trim(), $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("_id name email role department")
      .limit(20)
      .sort({ name: 1 });

    return res.status(200).json({ users });
  } catch (err) {
    console.error("searchUsers error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Create a new project
// @route   POST /api/projects
// @access  Manager, HR Admin
// =============================================================================

exports.createProject = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const {
      title,
      description,
      startDate,
      endDate,
      assignedEmployees,
      assignedManagers,
      notificationDays,
      subtasks,
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ message: "title, startDate and endDate are required" });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: "endDate must be after startDate" });
    }

    if (assignedEmployees?.length) {
      const employees = await User.find({
        _id: { $in: assignedEmployees },
        role: "employee",
      });
      if (employees.length !== assignedEmployees.length) {
        return res.status(400).json({
          message: "One or more assigned employees are invalid or inactive",
        });
      }
    }

    let managerIds = [];

    if (currentUser.role === "manager") {
      if (assignedManagers?.length) {
        return res.status(403).json({
          message: "Managers cannot assign other managers to a project",
        });
      }
      managerIds = [currentUser._id];
    } else {
      if (assignedManagers?.length) {
        const managers = await User.find({
          _id: { $in: assignedManagers },
          role: { $in: ["manager", "hr_admin"] },
        });
        if (managers.length !== assignedManagers.length) {
          return res.status(400).json({
            message: "One or more assigned managers are invalid or inactive",
          });
        }
        managerIds = [...assignedManagers];
      }
    }

    const project = await Project.create({
      title,
      description: description || "",
      startDate,
      endDate,
      assignedEmployees: assignedEmployees || [],
      assignedManagers: managerIds,
      createdBy: currentUser._id,
      notificationDays: notificationDays || 4,
    });

    if (subtasks?.length) {
      const subtaskDocs = subtasks.map((st, index) => ({
        project: project._id,
        name: st.name,
        description: st.description || "",
        startDate: st.startDate,
        dueDate: st.dueDate,
        order: st.order ?? index,
      }));
      await Subtask.insertMany(subtaskDocs);
    }

    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "project_created",
      description: `${currentUser.fullName} created project "${title}"`,
      metadata: { title, startDate, endDate },
    });

    if (assignedEmployees?.length) {
      const notifPromises = assignedEmployees.map((empId) =>
        createNotification({
          recipient: empId,
          project: project._id,
          eventType: "project_assigned",
          message: `You have been assigned to project "${title}". Starts ${new Date(startDate).toDateString()}, ends ${new Date(endDate).toDateString()}.`,
          metadata: { projectId: project._id, title },
        })
      );
      await Promise.all(notifPromises);
    }

    const populated = await Project.findById(project._id)
      .populate("assignedEmployees", "fullName email department")
      .populate("assignedManagers", "fullName email")
      .populate("createdBy", "fullName");

    return res.status(201).json({ message: "Project created", project: populated });
  } catch (err) {
    console.error("createProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get all projects (role-scoped)
// @route   GET /api/projects
// @access  All roles
// =============================================================================

exports.getProjects = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const filter = getScopeFilter(currentUser);

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const projects = await Project.find(filter)
      .populate("assignedEmployees", "fullName email department")
      .populate("assignedManagers", "fullName email")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    const projectIds = projects.map((p) => p._id);
    const [progressMap, ratingMap] = await Promise.all([
      getProgressMap(projectIds),
      getRatingMap(projectIds),
    ]);

    const projectsWithMeta = projects.map((p) => {
      const pid = p._id.toString();
      const progress = progressMap[pid] || { total: 0, completed: 0, percent: 0 };
      const rating = ratingMap[pid] || { avg: null };
      return {
        ...p.toObject(),
        progress,
        avgRating: rating.avg,
      };
    });

    return res.status(200).json({ projects: projectsWithMeta });
  } catch (err) {
    console.error("getProjects error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get a single project by ID
// @route   GET /api/projects/:id
// @access  All roles (scoped — must be assigned to the project)
// =============================================================================

exports.getProject = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const filter = { _id: req.params.id, isDeleted: false };

    if (currentUser.role === "employee") {
      filter.assignedEmployees = currentUser._id;
    } else if (currentUser.role === "manager") {
      filter.$or = [
        { assignedManagers: currentUser._id },
        { createdBy: currentUser._id },
      ];
    }

    const project = await Project.findOne(filter)
      .populate("assignedEmployees", "fullName email department")
      .populate("assignedManagers", "fullName email")
      .populate("createdBy", "fullName");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const subtasks = await Subtask.find({
      project: project._id,
      isDeleted: false,
    })
      .populate("completedBy", "fullName")
      .sort({ order: 1 });

    const Rating = require("../models/Rating");
    const subtaskIds = subtasks.map((s) => s._id);
    const ratings = await Rating.find({
      subtask: { $in: subtaskIds },
      isArchived: false,
    }).populate("ratedBy", "fullName");

    const ratingBySubtask = {};
    for (const r of ratings) {
      ratingBySubtask[r.subtask.toString()] = r;
    }

    const subtasksWithRatings = subtasks.map((st) => ({
      ...st.toObject(),
      rating: ratingBySubtask[st._id.toString()] || null,
    }));

    const total = subtasks.length;
    const completed = subtasks.filter((s) => s.status === "completed").length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return res.status(200).json({
      project: {
        ...project.toObject(),
        subtasks: subtasksWithRatings,
        progress: { total, completed, percent },
      },
    });
  } catch (err) {
    console.error("getProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Edit a project
// @route   PATCH /api/projects/:id
// @access  Manager (own projects), HR Admin (all)
// =============================================================================

exports.editProject = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const filter = { _id: req.params.id, isDeleted: false };

    if (currentUser.role === "manager") {
      filter.assignedManagers = currentUser._id;
    }

    const project = await Project.findOne(filter);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const allowedFields = [
      "title",
      "description",
      "startDate",
      "endDate",
      "status",
      "notificationDays",
    ];

    const changes = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        changes[field] = { from: project[field], to: req.body[field] };
        project[field] = req.body[field];
      }
    }

    if (req.body.endDate && req.body.startDate) {
      if (new Date(req.body.endDate) <= new Date(req.body.startDate)) {
        return res.status(400).json({ message: "endDate must be after startDate" });
      }
    }

    if (req.body.assignedEmployees !== undefined) {
      const employees = await User.find({
        _id: { $in: req.body.assignedEmployees },
        role: "employee",
      });
      if (employees.length !== req.body.assignedEmployees.length) {
        return res.status(400).json({
          message: "One or more assigned employees are invalid or inactive",
        });
      }
      changes.assignedEmployees = {
        from: project.assignedEmployees,
        to: req.body.assignedEmployees,
      };
      project.assignedEmployees = req.body.assignedEmployees;
    }

    if (req.body.assignedManagers !== undefined) {
      if (currentUser.role === "manager") {
        return res.status(403).json({
          message: "Managers cannot change manager assignments",
        });
      }
      const managers = await User.find({
        _id: { $in: req.body.assignedManagers },
        role: { $in: ["manager", "hr_admin"] },
      });
      if (managers.length !== req.body.assignedManagers.length) {
        return res.status(400).json({
          message: "One or more assigned managers are invalid or inactive",
        });
      }
      changes.assignedManagers = {
        from: project.assignedManagers,
        to: req.body.assignedManagers,
      };
      project.assignedManagers = req.body.assignedManagers;
    }

    await project.save();

    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "project_edited",
      description: `${currentUser.fullName} edited project "${project.title}"`,
      metadata: { changes },
    });

    const populated = await Project.findById(project._id)
      .populate("assignedEmployees", "fullName email department")
      .populate("assignedManagers", "fullName email")
      .populate("createdBy", "fullName");

    return res.status(200).json({ message: "Project updated", project: populated });
  } catch (err) {
    console.error("editProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Delete a project (soft delete)
// @route   DELETE /api/projects/:id
// @access  HR Admin only
// =============================================================================

exports.deleteProject = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const project = await Project.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.isDeleted = true;
    project.deletedAt = new Date();
    project.deletedBy = currentUser._id;
    await project.save();

    await Subtask.updateMany(
      { project: project._id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    const Rating = require("../models/Rating");
    await Rating.updateMany(
      { project: project._id, isArchived: false },
      { isArchived: true }
    );

    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "project_deleted",
      description: `${currentUser.fullName} deleted project "${project.title}"`,
      metadata: { title: project.title },
    });

    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
