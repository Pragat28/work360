    const express = require("express");
    const router = express.Router();
    const auth = require("../middleware/auth");

    const { deleteComment } = require("../controllers/commentController");
    const { getComments, addComment } = require("../controllers/commentController");

    router.get("/:id/comments", auth, getComments);
    router.post("/:id/comments", auth, addComment);

    // ── Comments ──────────────────────────────────────────────────────────────────
    router.delete("/:id", auth, deleteComment);

    module.exports = router;
