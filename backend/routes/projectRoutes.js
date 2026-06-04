const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  createProject,
  getProjects,
  getProject,
  editProject,
  deleteProject,
} = require("../controllers/projectController");

const {
  addEmployees,
  removeEmployee,
  addManagers,
  removeManager,
} = require("../controllers/assignmentController");

const {
  createSubtask,
} = require("../controllers/subtaskController");

const {
  getProjectTimeline,
} = require("../controllers/timelineController");

// ── Project CRUD ──────────────────────────────────────────────────────────────
router.post("/", auth, createProject);
router.get("/", auth, getProjects);
router.get("/:id", auth, getProject);
router.patch("/:id", auth, editProject);
router.delete("/:id", auth, deleteProject);

// ── Employee & Manager Assignment ─────────────────────────────────────────────
router.post("/:id/employees", auth, addEmployees);
router.delete("/:id/employees/:userId", auth, removeEmployee);
router.post("/:id/managers", auth, addManagers);
router.delete("/:id/managers/:userId", auth, removeManager);

// ── Subtasks ──────────────────────────────────────────────────────────────────
router.post("/:id/subtasks", auth, createSubtask);

// ── Timeline ──────────────────────────────────────────────────────────────────
router.get("/:id/timeline", auth, getProjectTimeline);

module.exports = router;