const express = require("express");
const router = express.Router();
const { TimetableSession } = require("../utils/mongooseToPrisma");
const { authenticateToken } = require("./auth");

// Apply authentication to all routes
router.use(authenticateToken);

// Create a new timetable session
router.post("/", async (req, res) => {
  try {
    const session = await TimetableSession.create(req.body);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all timetable sessions
router.get("/", async (req, res) => {
  try {
    const sessions = await TimetableSession.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a single timetable session by ID
router.get("/:id", async (req, res) => {
  try {
    const session = await TimetableSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: "Session not found" });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a timetable session
router.patch("/:id", async (req, res) => {
  try {
    const session = await TimetableSession.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a timetable session
router.delete("/:id", async (req, res) => {
  try {
    const session = await TimetableSession.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: "Session not found" });
    res.json({ success: true, message: "Session deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
