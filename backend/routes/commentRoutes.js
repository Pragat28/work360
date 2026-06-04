const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const { deleteComment } = require("../controllers/commentController");

// ── Comments ──────────────────────────────────────────────────────────────────
router.delete("/:id", auth, deleteComment);

module.exports = router;