const mongoose = require("mongoose");

const timetableSessionSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: String, required: true },
    semester: { type: String, required: true },
    selectedAlgorithm: {
      type: String,
      enum: ["greedy", "csp", "backtracking", "ga", "sa", "hybrid"],
      default: "hybrid"
    },
    status: {
      type: String,
      enum: ["draft", "data_pending", "ready", "generated", "published"],
      default: "draft"
    },
    config: {
      maxHoursPerDay: { type: Number, default: 8 },
      maxConsecutiveHours: { type: Number, default: 3 },
      breakMinutes: { type: Number, default: 15 },
      sameBuildingPreference: { type: Boolean, default: true },
      compactSchedulePreference: { type: Boolean, default: true },
      allowBackToBackLabs: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TimetableSession", timetableSessionSchema);
