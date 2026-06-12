const express = require("express");
const router = express.Router({ mergeParams: true });

const {
  createSubmission,
  getSubmissions,
  deleteSubmission,
} = require("../controllers/submissionController");

const { protect } = require("../middleware/Auth");
const { checkRole } = require("../middleware/roleMiddleware");
const { upload } = require("../config/cloudinary");

// POST /api/subtasks/:id/submissions  — employee submits work
router.post(
  "/",
  protect,
  checkRole("employee"),
  upload.array("files", 10),        // up to 10 files per submission
  createSubmission
);

// GET /api/subtasks/:id/submissions  — manager/hr sees all, employee sees own
router.get(
  "/",
  protect,
  checkRole("employee", "manager", "hr_admin"),
  getSubmissions
);

// DELETE /api/submissions/:id  — submitter or hr_admin deletes
router.delete(
  "/:id",
  protect,
  checkRole("employee", "hr_admin"),
  deleteSubmission
);

module.exports = router;
