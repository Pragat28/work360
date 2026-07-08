const Project = require("../models/Project");
const Subtask = require("../models/Subtask");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { projectAssignedEmail } = require("../config/emailTemplates");

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

    if (currentUser.role === "manager" && role && role !== "employee") {
      return res.status(403).json({ message: "Managers can only search for employees" });
    }

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

    let validatedEmployees = [];
    if (assignedEmployees?.length) {
      validatedEmployees = await User.find({
        _id: { $in: assignedEmployees },
        role: "employee",
      });
      if (validatedEmployees.length !== assignedEmployees.length) {
        return res.status(400).json({
          message: "One or more assigned employees are invalid or inactive",
        });
      }
    }

    let managerIds = [];
    let validatedManagers = []; // ── kept outside the branch so we can notify them below ──

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
        validatedManagers = managers;
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

    // ── Project-level timeline event ──────────────────────────────────────────
    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "project_created",
      description: `${currentUser.name} created project "${title}"`,
      metadata: { title, startDate, endDate },
    });

    if (validatedEmployees.length) {
      // ── Per-employee timeline events, independently of notifications ──────────
      await Promise.all(
        validatedEmployees.map((emp) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "employee_added",
            description: `${currentUser.name} added ${emp.name} to project "${title}"`,
            metadata: { employeeId: emp._id, employeeName: emp.name },
          })
        )
      );

      // ── Notifications — createNotification auto-CCs HR, no manual loop needed ─
      const notifPromises = validatedEmployees.map((emp) =>
        createNotification({
          recipient: emp._id,
          project: project._id,
          eventType: "project_assigned",
          message: `You have been assigned to project "${title}". Starts ${new Date(startDate).toDateString()}, ends ${new Date(endDate).toDateString()}.`,
          hrMessage: `${currentUser.name} assigned ${emp.name} to project "${title}". Starts ${new Date(startDate).toDateString()}, ends ${new Date(endDate).toDateString()}.`,
          metadata: { projectId: project._id, title },
        })
      );
      await Promise.all(notifPromises);

      // ── Emails (fire-and-forget) ──────────────────────────────────────────────
      validatedEmployees.forEach((emp) => {
        const { subject, html } = projectAssignedEmail(emp.name, title, startDate, endDate);
        transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: emp.email,
          subject,
          html,
        }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
      });
    }

    // ── Timeline + notification for managers assigned at creation (HR-created
    // projects only — a manager creating their own project already knows) ──────
    if (validatedManagers.length) {
      await Promise.all(
        validatedManagers.map((mgr) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "project_assigned",
            description: `${currentUser.name} added ${mgr.name} as manager of project "${title}"`,
            metadata: { managerId: mgr._id, managerName: mgr.name },
          })
        )
      );

      const managerNotifPromises = validatedManagers.map((mgr) =>
        createNotification({
          recipient: mgr._id,
          project: project._id,
          eventType: "project_assigned",
          message: `You have been assigned as manager of project "${title}". Starts ${new Date(startDate).toDateString()}, ends ${new Date(endDate).toDateString()}.`,
          hrMessage: `${currentUser.name} assigned ${mgr.name} as manager of project "${title}". Starts ${new Date(startDate).toDateString()}, ends ${new Date(endDate).toDateString()}.`,
          metadata: { projectId: project._id, title },
        })
      );
      await Promise.all(managerNotifPromises);
    }

    await createNotification({
      recipient: currentUser._id,
      project: project._id,
      eventType: "project_created",
      message: `You created project "${title}".`,
      hrMessage: `${currentUser.name} created project "${title}".`,
      metadata: { title, startDate, endDate, actorId: currentUser._id },
    });

    const populated = await Project.findById(project._id)
      .populate("assignedEmployees", "name email department")
      .populate("assignedManagers", "name email")
      .populate("createdBy", "name");

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
      .populate("assignedEmployees", "name email department")
      .populate("assignedManagers", "name email")
      .populate("createdBy", "name")
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
      .populate("assignedEmployees", "name email department")
      .populate("assignedManagers", "name email")
      .populate("createdBy", "name");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const subtasks = await Subtask.find({
      project: project._id,
      isDeleted: false,
    })
      .populate("assignedTo", "name email department")
      .sort({ order: 1 });

    const Rating = require("../models/Rating");
    const subtaskIds = subtasks.map((s) => s._id);
    const ratings = await Rating.find({
      subtask: { $in: subtaskIds },
      isArchived: false,
    }).populate("ratedBy", "name");

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

    // ── fieldChanges tracks ONLY plain field edits (title, dates, status, etc.)
    // This is kept separate from membership changes so that adding/removing an
    // employee or manager does NOT, by itself, fire a generic "project_edited"
    // timeline event / notification alongside the specific membership event.
    const fieldChanges = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fieldChanges[field] = { from: project[field], to: req.body[field] };
        project[field] = req.body[field];
      }
    }

    if (req.body.endDate && req.body.startDate) {
      if (new Date(req.body.endDate) <= new Date(req.body.startDate)) {
        return res.status(400).json({ message: "endDate must be after startDate" });
      }
    }

    // ── changes holds the full diff (fields + membership) purely for metadata
    // logging on the project_edited event when it does fire.
    const changes = { ...fieldChanges };

    // ── Track newly added and removed employees ───────────────────────────────
    let newlyAddedEmployees = [];
    let removedEmployees = [];

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

      const previousIds = project.assignedEmployees.map((id) => id.toString());
      const newIds = req.body.assignedEmployees.map((id) => id.toString());

      const addedIds = newIds.filter((id) => !previousIds.includes(id));
      const removedIds = previousIds.filter((id) => !newIds.includes(id));

      newlyAddedEmployees = employees.filter((e) => addedIds.includes(e._id.toString()));

      // Fetch removed employees' details for notification + timeline
      if (removedIds.length) {
        removedEmployees = await User.find({ _id: { $in: removedIds } }).select("name email");
      }

      changes.assignedEmployees = {
        from: project.assignedEmployees,
        to: req.body.assignedEmployees,
      };
      project.assignedEmployees = req.body.assignedEmployees;
    }

    // ── Track newly added and removed managers ─────────────────────────────────
    let newlyAddedManagers = [];
    let removedManagers = [];

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

      const previousManagerIds = project.assignedManagers.map((id) => id.toString());
      const newManagerIds = req.body.assignedManagers.map((id) => id.toString());

      const addedManagerIds = newManagerIds.filter((id) => !previousManagerIds.includes(id));
      const removedManagerIds = previousManagerIds.filter((id) => !newManagerIds.includes(id));

      newlyAddedManagers = managers.filter((m) => addedManagerIds.includes(m._id.toString()));

      if (removedManagerIds.length) {
        removedManagers = await User.find({ _id: { $in: removedManagerIds } }).select("name email");
      }

      changes.assignedManagers = {
        from: project.assignedManagers,
        to: req.body.assignedManagers,
      };
      project.assignedManagers = req.body.assignedManagers;
    }

    await project.save();

    // ── Generic "project edited" timeline + notification ───────────────────────
    // Only fires when an actual field (title, description, dates, status,
    // notificationDays) changed. Pure membership changes (employees/managers
    // added or removed) are reported via their own specific events below, so
    // we don't want a redundant "Project edited" entry cluttering the feed.
    const hasFieldChanges = Object.keys(fieldChanges).length > 0;

    if (hasFieldChanges) {
      await createTimelineEvent({
        project: project._id,
        actor: currentUser._id,
        eventType: "project_edited",
        description: `${currentUser.name} edited project "${project.title}"`,
        metadata: { changes },
      });

      await createNotification({
        recipient: currentUser._id,
        project: project._id,
        eventType: "project_edited",
        message: `You edited project "${project.title}".`,
        hrMessage: `${currentUser.name} edited project "${project.title}".`,
        metadata: { changes, actorId: currentUser._id },
      });
    }

    // ── Timeline + notification + email for newly added employees ─────────────
    if (newlyAddedEmployees.length) {
      const { addedToProjectEmail } = require("../config/emailTemplates");

      // Timeline events first, independently
      await Promise.all(
        newlyAddedEmployees.map((emp) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "employee_added",
            description: `${currentUser.name} added ${emp.name} to project "${project.title}"`,
            metadata: { employeeId: emp._id, employeeName: emp.name },
          })
        )
      );

      const notifPromises = newlyAddedEmployees.map((emp) =>
        createNotification({
          recipient: emp._id,
          project: project._id,
          eventType: "employee_added",
          message: `You have been added to project "${project.title}".`,
          hrMessage: `${currentUser.name} added ${emp.name} to project "${project.title}".`,
          metadata: { projectId: project._id },
        })
      );
      await Promise.all(notifPromises);

      newlyAddedEmployees.forEach((emp) => {
        const { subject, html } = addedToProjectEmail(
          emp.name,
          project.title,
          project.startDate,
          project.endDate
        );
        transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: emp.email,
          subject,
          html,
        }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
      });
    }

    // ── Timeline + notification + email for removed employees ─────────────────
    if (removedEmployees.length) {
      const { removedFromProjectEmail } = require("../config/emailTemplates");

      // Timeline events first, independently
      await Promise.all(
        removedEmployees.map((emp) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "employee_removed",
            description: `${currentUser.name} removed ${emp.name} from project "${project.title}"`,
            metadata: { employeeId: emp._id, employeeName: emp.name },
          })
        )
      );

      const notifPromises = removedEmployees.map((emp) =>
        createNotification({
          recipient: emp._id,
          project: project._id,
          eventType: "employee_removed",
          message: `You have been removed from project "${project.title}".`,
          hrMessage: `${currentUser.name} removed ${emp.name} from project "${project.title}".`,
          metadata: { projectId: project._id, employeeId: emp._id },
        })
      );
      await Promise.all(notifPromises);

      removedEmployees.forEach((emp) => {
        const { subject, html } = removedFromProjectEmail(emp.name, project.title);
        transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: emp.email,
          subject,
          html,
        }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
      });
    }

    // ── Timeline + notification for newly added managers ───────────────────────
    if (newlyAddedManagers.length) {
      await Promise.all(
        newlyAddedManagers.map((mgr) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "project_assigned",
            description: `${currentUser.name} added ${mgr.name} to project "${project.title}"`,
            metadata: { managerId: mgr._id, managerName: mgr.name },
          })
        )
      );

      const managerAddedNotifPromises = newlyAddedManagers.map((mgr) =>
        createNotification({
          recipient: mgr._id,
          project: project._id,
          eventType: "project_assigned",
          message: `You have been assigned to project "${project.title}".`,
          hrMessage: `${currentUser.name} added ${mgr.name} to project "${project.title}".`,
          metadata: { projectId: project._id, managerId: mgr._id },
        })
      );
      await Promise.all(managerAddedNotifPromises);
    }

    // ── Timeline + notification for removed managers ───────────────────────────
    if (removedManagers.length) {
      await Promise.all(
        removedManagers.map((mgr) =>
          createTimelineEvent({
            project: project._id,
            actor: currentUser._id,
            eventType: "manager_removed",
            description: `${currentUser.name} removed ${mgr.name} from project "${project.title}"`,
            metadata: { managerId: mgr._id, managerName: mgr.name },
          })
        )
      );

      const managerRemovedNotifPromises = removedManagers.map((mgr) =>
        createNotification({
          recipient: mgr._id,
          project: project._id,
          eventType: "manager_removed",
          message: `You have been removed as a manager from project "${project.title}".`,
          hrMessage: `${currentUser.name} removed ${mgr.name} as a manager from project "${project.title}".`,
          metadata: { projectId: project._id, managerId: mgr._id },
        })
      );
      await Promise.all(managerRemovedNotifPromises);
    }

    const populated = await Project.findById(project._id)
      .populate("assignedEmployees", "name email department")
      .populate("assignedManagers", "name email")
      .populate("createdBy", "name");

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
      description: `${currentUser.name} deleted project "${project.title}"`,
      metadata: { title: project.title },
    });

    await createNotification({
      recipient: currentUser._id,
      project: project._id,
      eventType: "project_deleted",
      message: `You deleted project "${project.title}".`,
      hrMessage: `${currentUser.name} deleted project "${project.title}".`,
      metadata: { title: project.title, actorId: currentUser._id },
    });

    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
