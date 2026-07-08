const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const Rating = require("../models/Rating");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { subtaskAssignedEmail } = require("../config/emailTemplates");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: verify the requesting user can manage this project ───────────────
const getEditableProject = async (projectId, user) => {
  const filter = { _id: projectId, isDeleted: false };
  if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  return Project.findOne(filter);
};

// ─── Helper: verify the employee is assigned to the project ──────────────────
const getAssignedProject = async (projectId, employeeId) => {
  return Project.findOne({
    _id: projectId,
    isDeleted: false,
    assignedEmployees: employeeId,
  });
};

// ─── Helper: extend project end date if a subtask's due date exceeds it ──────
const extendProjectEndDateIfNeeded = async (project, subtaskDueDate) => {
  const due = new Date(subtaskDueDate);
  const currentEnd = new Date(project.endDate);
  if (due > currentEnd) {
    project.endDate = due;
    await project.save();
    return true; // indicates the project end date was extended
  }
  return false;
};

// ─── Helper: notify + email a freshly assigned group of users ────────────────
// Also logs a single "subtask_assigned" timeline event listing everyone who
// was newly assigned, whether this came from subtask creation or an edit.
// Notifies every assigned employee (HR auto-CC'd per recipient) AND every
// manager on the project, including the actor themselves if they're a manager.
const notifyAssignedUsers = async (userIds, { project, subtask, dueDate, actor }) => {
  if (!userIds?.length) return;

  const users = await User.find({ _id: { $in: userIds } }).select("name email");

  const notifPromises = users.map((u) =>
    createNotification({
      recipient: u._id,
      project: project._id,
      subtask: subtask._id,
      eventType: "subtask_assigned",
      message: `You have been assigned to subtask "${subtask.name}" in project "${project.title}". Due ${new Date(dueDate).toDateString()}.`,
      hrMessage: `${actor.name} assigned ${u.name} to subtask "${subtask.name}" in project "${project.title}". Due ${new Date(dueDate).toDateString()}.`,
      metadata: { subtaskId: subtask._id, name: subtask.name },
    })
  );
  await Promise.all(notifPromises);

  // ── Notify every manager on the project, including the actor if they're
  // a manager. HR already CC'd above, so ccHrAdmins is false here to avoid
  // duplicating HR notifications ──────────────────────────────────────────
  const assignedNames = users.map((u) => u.name).join(", ");
  const managerNotifPromises = project.assignedManagers.map((managerId) =>
    createNotification({
      recipient: managerId,
      project: project._id,
      subtask: subtask._id,
      eventType: "subtask_assigned",
      message: `${actor.name} assigned ${assignedNames} to subtask "${subtask.name}" in project "${project.title}".`,
      metadata: { subtaskId: subtask._id, name: subtask.name },
      ccHrAdmins: false,
    })
  );
  await Promise.all(managerNotifPromises);

  // ── Timeline event: record who was assigned, by whom ────────────────────
  await createTimelineEvent({
    project: project._id,
    subtask: subtask._id,
    actor: actor._id,
    eventType: "subtask_assigned",
    description: `${actor.name} assigned ${assignedNames} to subtask "${subtask.name}" in project "${project.title}"`,
    metadata: {
      subtaskId: subtask._id,
      assignedUserIds: users.map((u) => u._id),
      assignedNames: users.map((u) => u.name),
    },
  });

  users.forEach((u) => {
    const { subject, html } = subtaskAssignedEmail(u.name, subtask.name, project.title, dueDate);
    transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: u.email,
      subject,
      html,
    }).catch((err) => console.error(`Email failed for ${u.email}:`, err.message));
  });
};

// =============================================================================
// @desc    Create a subtask on a project
// @route   POST /api/projects/:id/subtasks
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.createSubtask = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const project = await getEditableProject(req.params.id, currentUser);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const { name, description, startDate, dueDate, order, assignedTo } = req.body;

    if (!name || !startDate || !dueDate) {
      return res.status(400).json({ message: "name, startDate and dueDate are required" });
    }

    if (new Date(dueDate) <= new Date(startDate)) {
      return res.status(400).json({ message: "dueDate must be after startDate" });
    }

    let subtaskOrder = order;
    if (subtaskOrder === undefined) {
      const lastSubtask = await Subtask.findOne({
        project: project._id,
        isDeleted: false,
      }).sort({ order: -1 });
      subtaskOrder = lastSubtask ? lastSubtask.order + 1 : 0;
    }

    const subtask = await Subtask.create({
      project: project._id,
      name,
      description: description || "",
      startDate,
      dueDate,
      order: subtaskOrder,
      assignedTo: assignedTo || [],
    });

    // ── Auto-extend project end date if this subtask's due date exceeds it ────
    const wasExtended = await extendProjectEndDateIfNeeded(project, dueDate);

    // ── Reopen the project if it had been marked completed ────────────────────
    // Adding a new subtask means the project is no longer fully done, so a
    // "completed" project must revert to an active status.
    let wasReopened = false;
    if (project.status === "completed") {
      project.status = "assigned";
      await project.save();
      wasReopened = true;
    }

    // ── Notify every manager on the project (HR auto-CC'd inside
    // createNotification), including the actor if they're a manager ───────────
    const managerNotifPromises = project.assignedManagers.map((managerId) =>
      createNotification({
        recipient: managerId,
        project: project._id,
        subtask: subtask._id,
        eventType: "subtask_created",
        message: `${currentUser.name} added subtask "${name}" to project "${project.title}". Due ${new Date(dueDate).toDateString()}.`,
        metadata: { subtaskId: subtask._id, name, dueDate },
      })
    );
    await Promise.all(managerNotifPromises);

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_created",
      description: `${currentUser.name} added subtask "${name}" to project "${project.title}"`,
      metadata: { subtaskId: subtask._id, name, dueDate },
    });

    if (wasExtended) {
      await createTimelineEvent({
        project: project._id,
        subtask: subtask._id,
        actor: currentUser._id,
        eventType: "project_edited",
        description: `Project "${project.title}" end date auto-extended to ${new Date(dueDate).toDateString()} to match subtask "${name}"`,
        metadata: { newEndDate: dueDate, reason: "subtask_due_date_exceeded" },
      });
    }

    if (wasReopened) {
      await createTimelineEvent({
        project: project._id,
        subtask: subtask._id,
        actor: currentUser._id,
        eventType: "project_edited",
        description: `Project "${project.title}" status reverted to "assigned" after adding subtask "${name}"`,
        metadata: { newStatus: "assigned", reason: "new_subtask_added_to_completed_project" },
      });
    }

    // Notify + email assigned users and managers (also logs subtask_assigned timeline event)
    await notifyAssignedUsers(assignedTo, { project, subtask, dueDate, actor: currentUser });

    const populated = await Subtask.findById(subtask._id)
      .populate("assignedTo", "name email department");

    return res.status(201).json({
      message: "Subtask created",
      subtask: populated,
      projectEndDateExtended: wasExtended,
      projectReopened: wasReopened,
    });
  } catch (err) {
    console.error("createSubtask error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Edit a subtask
// @route   PATCH /api/subtasks/:id
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.editSubtask = async (req, res) => {
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

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to edit this subtask" });
    }

    const allowedFields = ["name", "description", "startDate", "dueDate", "status", "order"];
    const changes = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        changes[field] = { from: subtask[field], to: req.body[field] };
        subtask[field] = req.body[field];
      }
    }

    // ── Handle assignedTo update ──────────────────────────────────────────────
    let addedIds = [];
    if (req.body.assignedTo !== undefined) {
      const previousIds = subtask.assignedTo.map((id) => id.toString());
      const newIds = req.body.assignedTo.map((id) => id.toString());
      addedIds = newIds.filter((id) => !previousIds.includes(id));

      subtask.assignedTo = req.body.assignedTo;
      changes.assignedTo = { from: previousIds, to: newIds };
    }

    if (req.body.dueDate) {
      subtask.reminderSentAt = null;
    }

    await subtask.save();

    // ── Auto-extend project end date if dueDate was changed and now exceeds it ─
    let wasExtended = false;
    if (req.body.dueDate !== undefined) {
      wasExtended = await extendProjectEndDateIfNeeded(project, subtask.dueDate);
    }

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_edited",
      description: `${currentUser.name} edited subtask "${subtask.name}"`,
      metadata: { changes },
    });

    // ── Notify currently assigned employees + all managers that the subtask
    // was edited (HR auto-CC'd once via the employee loop; the manager loop
    // only CCs HR if there were no assigned employees to CC through) ───────
    if (Object.keys(changes).length > 0) {
      const currentlyAssignedIds = subtask.assignedTo.map((id) => id.toString());

      const employeeEditNotifPromises = currentlyAssignedIds.map((employeeId) =>
        createNotification({
          recipient: employeeId,
          project: project._id,
          subtask: subtask._id,
          eventType: "subtask_edited",
          message: `Subtask "${subtask.name}" in project "${project.title}" was updated by ${currentUser.name}.`,
          hrMessage: `${currentUser.name} edited subtask "${subtask.name}" in project "${project.title}".`,
          metadata: { subtaskId: subtask._id, name: subtask.name, changes },
        })
      );

      const managerEditNotifPromises = project.assignedManagers.map((managerId) =>
        createNotification({
          recipient: managerId,
          project: project._id,
          subtask: subtask._id,
          eventType: "subtask_edited",
          message: `${currentUser.name} edited subtask "${subtask.name}" in project "${project.title}".`,
          metadata: { subtaskId: subtask._id, name: subtask.name, changes },
          ccHrAdmins: currentlyAssignedIds.length === 0,
        })
      );

      await Promise.all([...employeeEditNotifPromises, ...managerEditNotifPromises]);
    }

    if (wasExtended) {
      await createTimelineEvent({
        project: subtask.project,
        subtask: subtask._id,
        actor: currentUser._id,
        eventType: "project_edited",
        description: `Project "${project.title}" end date auto-extended to ${new Date(subtask.dueDate).toDateString()} to match subtask "${subtask.name}"`,
        metadata: { newEndDate: subtask.dueDate, reason: "subtask_due_date_exceeded" },
      });
    }

    // Notify + email only newly added users and all managers (also logs subtask_assigned timeline event)
    await notifyAssignedUsers(addedIds, { project, subtask, dueDate: subtask.dueDate, actor: currentUser });

    const populated = await Subtask.findById(subtask._id)
      .populate("assignedTo", "name email department");

    return res.status(200).json({ message: "Subtask updated", subtask: populated, projectEndDateExtended: wasExtended });
  } catch (err) {
    console.error("editSubtask error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Delete a subtask (soft delete, archives rating)
// @route   DELETE /api/subtasks/:id
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.deleteSubtask = async (req, res) => {
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

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to delete this subtask" });
    }

    const previouslyAssignedIds = subtask.assignedTo.map((id) => id.toString());

    subtask.isDeleted = true;
    subtask.deletedAt = new Date();
    await subtask.save();

    await Rating.updateMany(
      { subtask: subtask._id },
      { isArchived: true }
    );

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_deleted",
      description: `${currentUser.name} deleted subtask "${subtask.name}" from project "${project.title}"`,
      metadata: { subtaskName: subtask.name, hadRating: true },
    });

    const assignedNotifPromises = previouslyAssignedIds.map((employeeId) =>
      createNotification({
        recipient: employeeId,
        project: project._id,
        eventType: "subtask_deleted",
        message: `Subtask "${subtask.name}" in project "${project.title}" has been deleted and is no longer assigned to you.`,
        hrMessage: `${currentUser.name} deleted subtask "${subtask.name}" from project "${project.title}".`,
        metadata: { subtaskName: subtask.name },
      })
    );

    // ── Notify every manager on the project, including the actor if
    // they're the manager who deleted it ───────────────────────────────────
    const managerNotifPromises = project.assignedManagers.map((managerId) =>
      createNotification({
        recipient: managerId,
        project: project._id,
        eventType: "subtask_deleted",
        message: `${currentUser.name} deleted subtask "${subtask.name}" from project "${project.title}".`,
        metadata: { subtaskName: subtask.name },
      })
    );

    await Promise.all([...assignedNotifPromises, ...managerNotifPromises]);

    return res.status(200).json({ message: "Subtask deleted" });
  } catch (err) {
    console.error("deleteSubtask error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Search users to assign to a subtask
// @route   GET /api/subtasks/:id/search-users
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.searchAssignableUsers = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const subtask = await Subtask.findOne({ _id: req.params.id, isDeleted: false });
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) return res.status(403).json({ message: "Not authorised" });

    const { search } = req.query;

    const filter = {
      role: "employee",
      _id: { $in: project.assignedEmployees },
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter).select("name email department").limit(20);

    return res.status(200).json({ users });
  } catch (err) {
    console.error("searchAssignableUsers error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    List subtasks, optionally filtered by status (e.g. "overdue").
//          For "overdue" specifically: also catches subtasks whose dueDate
//          has passed and aren't completed yet, even if the cron hasn't
//          flipped their stored status to "overdue" yet — same live-fallback
//          idea used in timelineController's getTimelineStats.
//          Scoped by role — employee sees only their own assigned subtasks,
//          manager sees subtasks on projects they manage, hr_admin sees all.
// @route   GET /api/subtasks?status=overdue&projectId=<id|omit>
// @access  All roles
// =============================================================================

exports.getSubtasks = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { status, projectId } = req.query;
    const filter = { isDeleted: false };

    // ── Status filter — "overdue" gets the live-fallback OR condition,
    //    everything else filters normally on the stored field ─────────────
    if (status === "overdue") {
      filter.$or = [
        { status: "overdue" },
        { status: { $nin: ["completed", "overdue"] }, dueDate: { $lt: new Date() } },
      ];
    } else if (status) {
      filter.status = status;
    }

    // ── Role scoping ───────────────────────────────────────────────────────
    if (currentUser.role === "employee") {
      filter.assignedTo = currentUser._id;
    } else if (currentUser.role === "manager") {
      const managedProjects = await Project.find({
        assignedManagers: currentUser._id,
        isDeleted: false,
      }).select("_id");
      filter.project = { $in: managedProjects.map((p) => p._id) };
    }
    // hr_admin: no restriction — sees all

    // ── Optional single-project narrowing (validated against scope) ───────
    if (projectId && projectId !== "all") {
      if (currentUser.role === "manager") {
        const allowedIds = (filter.project?.$in || []).map((id) => id.toString());
        if (!allowedIds.includes(projectId)) {
          return res.status(403).json({ message: "Access to this project is not allowed" });
        }
      }
      filter.project = projectId;
    }

    const subtasks = await Subtask.find(filter)
      .populate("project", "title")
      .populate("assignedTo", "name email")
      .sort({ dueDate: 1 });

    return res.status(200).json({ subtasks });
  } catch (err) {
    console.error("getSubtasks error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
