const mongoose = require("mongoose");

const subtaskSubmissionSchema = new mongoose.Schema(
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

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    files: [
      {
        originalName: { type: String, required: true },
        cloudinaryUrl: { type: String, required: true },
        cloudinaryPublicId: { type: String, required: true },
        fileType: { type: String, required: true },
        fileSize: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

subtaskSubmissionSchema.index({ subtask: 1, isDeleted: 1 });
subtaskSubmissionSchema.index({ submittedBy: 1, isDeleted: 1 });

module.exports = mongoose.model("SubtaskSubmission", subtaskSubmissionSchema);
