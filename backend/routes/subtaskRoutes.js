const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const checkRole = require("../middleware/roleMiddleware");

const {
  getSubtasks,
  editSubtask,
  deleteSubtask,
  startSubtask,
  completeSubtask,
  searchAssignableUsers 
} = require("../controllers/subtaskController");

const {
  getComments,
  addComment,
} = require("../controllers/commentController");

const {
  submitRating,
  updateRating,
  getRating,
} = require("../controllers/ratingController");

router.get("/", auth, getSubtasks);

// ── Subtask actions ───────────────────────────────────────────────────────────
router.patch("/:id", auth, editSubtask);
router.delete("/:id", auth, deleteSubtask);
router.patch("/:id/start", auth, startSubtask);
router.patch("/:id/complete", auth, completeSubtask);
router.get("/:id/search-users", auth, checkRole("manager", "hr_admin"), searchAssignableUsers);
// ── Comments ──────────────────────────────────────────────────────────────────
router.get("/:id/comments", auth, getComments);
router.post("/:id/comments", auth, addComment);

// ── Ratings ───────────────────────────────────────────────────────────────────
router.post("/:id/rating", auth, submitRating);
router.patch("/:id/rating", auth, updateRating);
router.get("/:id/rating", auth, getRating);

module.exports = router;
