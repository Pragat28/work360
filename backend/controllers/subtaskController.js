const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const Rating = require("../models/Rating");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");

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

    const { name, description, startDate, dueDate, order } = req.body;

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
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_created",
      description: `${currentUser.fullName} added subtask "${name}" to project "${project.title}"`,
      metadata: { subtaskId: subtask._id, name, dueDate },
    });

    return res.status(201).json({ message: "Subtask created", subtask });
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

    if (req.body.dueDate) {
      subtask.reminderSentAt = null;
    }

    await subtask.save();

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_created",
      description: `${currentUser.fullName} edited subtask "${subtask.name}"`,
      metadata: { changes },
    });

    return res.status(200).json({ message: "Subtask updated", subtask });
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
      description: `${currentUser.fullName} deleted subtask "${subtask.name}" from project "${project.title}"`,
      metadata: { subtaskName: subtask.name, hadRating: true },
    });

    return res.status(200).json({ message: "Subtask deleted" });
  } catch (err) {
    console.error("deleteSubtask error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Employee marks subtask as Started
// @route   PATCH /api/subtasks/:id/start
// @access  Employee only (must be assigned to the project)
// =============================================================================

exports.startSubtask = async (req, res) => {
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

    const project = await getAssignedProject(subtask.project, currentUser._id);
    if (!project) {
      return res.status(403).json({ message: "You are not assigned to this project" });
    }

    if (subtask.status !== "pending") {
      return res.status(400).json({
        message: `Subtask is already ${subtask.status} and cannot be started`,
      });
    }

    subtask.status = "in_progress";
    subtask.startedAt = new Date();
    await subtask.save();

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_started",
      description: `${currentUser.fullName} started subtask "${subtask.name}"`,
      metadata: { startedAt: subtask.startedAt },
    });

    return res.status(200).json({ message: "Subtask marked as started", subtask });
  } catch (err) {
    console.error("startSubtask error:", err);
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

    const { search, role } = req.query;

    const filter = {
      role: role || "employee",
      _id: { $in: project.assignedEmployees }, // only employees on this project
    };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter).select("fullName email department").limit(20);

    return res.status(200).json({ users });
  } catch (err) {
    console.error("searchAssignableUsers error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Employee marks subtask as Completed
// @route   PATCH /api/subtasks/:id/complete
// @access  Employee only (must be assigned to the project)
// =============================================================================

exports.completeSubtask = async (req, res) => {
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

    const project = await getAssignedProject(subtask.project, currentUser._id);
    if (!project) {
      return res.status(403).json({ message: "You are not assigned to this project" });
    }

    if (subtask.status === "completed") {
      return res.status(400).json({ message: "Subtask is already completed" });
    }

    if (subtask.status === "pending") {
      return res.status(400).json({
        message: "Please start the subtask before marking it complete",
      });
    }

    subtask.status = "completed";
    subtask.completedAt = new Date();
    subtask.completedBy = currentUser._id;
    await subtask.save();

    await createTimelineEvent({
      project: subtask.project,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "subtask_completed",
      description: `${currentUser.fullName} completed subtask "${subtask.name}"`,
      metadata: { completedAt: subtask.completedAt },
    });

    const notifPromises = project.assignedManagers.map((managerId) =>
      createNotification({
        recipient: managerId,
        project: project._id,
        subtask: subtask._id,
        eventType: "subtask_completed",
        message: `${currentUser.fullName} has completed "${subtask.name}" in project "${project.title}". Please log in to rate it.`,
        metadata: {
          employeeName: currentUser.fullName,
          subtaskName: subtask.name,
        },
      })
    );
    await Promise.all(notifPromises);

    const allSubtasks = await Subtask.find({
      project: project._id,
      isDeleted: false,
    });
    const allCompleted = allSubtasks.every((st) =>
      st._id.toString() === subtask._id.toString()
        ? true
        : st.status === "completed"
    );

    if (allCompleted) {
      await Project.findByIdAndUpdate(project._id, { status: "completed" });

      const recipients = [...project.assignedManagers];

      const avgRating = await Rating.aggregate([
        { $match: { project: project._id, isArchived: false } },
        { $group: { _id: null, avg: { $avg: "$stars" } } },
      ]);

      const avg = avgRating[0]?.avg?.toFixed(1) || "N/A";

      const projectCompletePromises = recipients.map((recipientId) =>
        createNotification({
          recipient: recipientId,
          project: project._id,
          eventType: "project_completed",
          message: `Project "${project.title}" is fully complete. Average rating: ${avg}/5.`,
          metadata: { avgRating: avg },
        })
      );
      await Promise.all(projectCompletePromises);
    }

    return res.status(200).json({ message: "Subtask marked as completed", subtask });
  } catch (err) {
    console.error("completeSubtask error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
