const express = require("express");

// Router for /api/subtasks/:id/submissions (needs mergeParams for :id)
const subtaskRouter = express.Router({ mergeParams: true });
// Router for /api/submissions/:id (standalone delete)
const submissionRouter = express.Router();

const { createSubmission, getSubmissions, deleteSubmission } = require("../controllers/submissionController");
const protect = require("../middleware/Auth");
const checkRole = require("../middleware/roleMiddleware");
const { upload } = require("../config/cloudinary");

// POST /api/subtasks/:id/submissions
subtaskRouter.post("/", protect, checkRole("employee"), upload.array("files", 10), createSubmission);

// GET /api/subtasks/:id/submissions
subtaskRouter.get("/", protect, checkRole("employee", "manager", "hr_admin"), getSubmissions);

// DELETE /api/submissions/:id
submissionRouter.delete("/:id", protect, checkRole("employee", "hr_admin"), deleteSubmission);

module.exports = { subtaskRouter, submissionRouter };
