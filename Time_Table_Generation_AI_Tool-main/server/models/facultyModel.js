const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema(
  {
    // Generator fields
    teacher_id: { type: String, unique: true, sparse: true },
    teacher_name: { type: String },
    dept_id: { type: String },
    subjects: [{ type: String }],
    preferred_building: { type: String, default: "" },
    availability: [
      {
        day: String,
        slots: [String]
      }
    ],
    
    // Old UI compatible fields (also used by generator)
    name: { type: String, required: true },
    department: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    
    // Generator alias fields (alternate names used by generator)
    dept_id: { type: String },  // alias for department
    
    // Additional fields for compatibility
    max_hours_per_day: { type: Number, default: 5 },
    is_active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Virtual to unify teacher_name and name
facultySchema.virtual('displayName').get(function() {
  return this.teacher_name || this.name;
});

// Ensure virtuals are included in JSON
facultySchema.set('toJSON', { virtuals: true });
facultySchema.set('toObject', { virtuals: true });

// Index for common queries
facultySchema.index({ department: 1 });
facultySchema.index({ is_active: 1 });

module.exports = mongoose.model("Faculty", facultySchema);