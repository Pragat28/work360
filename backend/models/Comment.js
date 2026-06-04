const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    subtask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtask",
      required: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    authorRole: {
      type: String,
      enum: ["manager", "hr_admin"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

commentSchema.index({ subtask: 1, isDeleted: 1, createdAt: 1 });
commentSchema.index({ project: 1, isDeleted: 1 });
commentSchema.index({ author: 1 });

module.exports = mongoose.model("Comment", commentSchema);