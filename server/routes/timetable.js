const express = require('express');
const { Teacher, Classroom, Course, Student, User, Program, Division, SystemConfig, Holiday, Timetable, TimetableSession, Query } = require('../utils/mongooseToPrisma');
const { body, validationResult } = require('express-validator');

const { generateTimetable, saveTimetable } = require('../utils/generator');
const { authenticateToken } = require('./auth');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/timetable/generate
 * @desc    Generate timetable using session-based data
 * @access  Private
 * 
 * Payload:
 * {
 *   sessionId,
 *   selectedAlgorithm,
 *   constraints
 * }
 */
router.post('/generate', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('selectedAlgorithm').isIn(['greedy', 'genetic', 'csp', 'hybrid', 'backtracking', 'simulated_annealing']).withMessage('Invalid algorithm'),
  body('constraints').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { sessionId, selectedAlgorithm, constraints = {} } = req.body;

    logger.info('[SESSION GENERATE] Starting session-based timetable generation', {
      sessionId,
      algorithm: selectedAlgorithm,
      startedBy: req.user?.userId
    });

    // Step 1: Load TimetableSession
    const session = await TimetableSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Timetable session not found'
      });
    }

    logger.info('[SESSION GENERATE] Session loaded', {
      sessionId,
      academicYear: session.academicYear,
      department: session.department,
      year: session.year,
      semester: session.semester
    });

    // Step 2: Load all data filtered by sessionId
    logger.info('[SESSION GENERATE] Loading data by sessionId');

    const [teachers, classrooms, courses, students, programs] = await Promise.all([
      Teacher.find({ sessionId, status: 'active' }),
      Classroom.find({ sessionId, status: 'available' }),
      Course.find({ sessionId, isActive: true }).populate('assignedTeachers.teacherId'),
      Student.find({ sessionId, isActive: true }),
      Program.find({ sessionId, isActive: true })
    ]);

    logger.info('[SESSION GENERATE] Data loaded', {
      teachers: teachers.length,
      classrooms: classrooms.length,
      courses: courses.length,
      students: students.length
    });

    if (courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No courses found for this session. Please add courses first.'
      });
    }

    if (teachers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No teachers found for this session. Please add teachers first.'
      });
    }

    if (classrooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No classrooms found for this session. Please add classrooms first.'
      });
    }

    // Step 3: Build teacher-subject mapping from courses
    const subjectTeacherMap = {};
    courses.forEach(course => {
      const courseId = course._id?.toString() || course.id;
      subjectTeacherMap[courseId] = [];
      
      if (course.assignedTeachers && course.assignedTeachers.length > 0) {
        course.assignedTeachers.forEach(at => {
          const teacherId = at.teacherId?._id?.toString() || at.teacherId?.toString();
          if (teacherId) {
            subjectTeacherMap[courseId].push(teacherId);
          }
        });
      }
    });

    logger.info('[SESSION GENERATE] Teacher-subject mapping built', {
      subjectsWithTeachers: Object.keys(subjectTeacherMap).length
    });

    // Step 4: Prepare data for generator utility
    // Transform data to match generator contract
    const subjects = courses.map(course => ({
      ...course.toObject ? course.toObject() : course,
      id: course._id?.toString() || course.id
    }));
    
    const teacherList = teachers.map(t => ({
      ...t.toObject ? t.toObject() : t,
      id: t._id?.toString() || t.id
    }));
    
    const roomList = classrooms.map(r => ({
      ...r.toObject ? r.toObject() : r,
      id: r._id?.toString() || r.id
    }));
    
    // Get sections from programs
    const sections = programs.map(p => ({
      ...p.toObject ? p.toObject() : p,
      id: p._id?.toString() || p.id
    }));

    // Step 5: Use the generator utility for consistent constraint handling
    logger.info('[SESSION GENERATE] Calling generator utility', { algorithm: selectedAlgorithm });
    
    const generationResult = await generateTimetable({
      teachers: teacherList,
      subjects,
      sections,
      rooms: roomList,
      timeSlots: [], // Generator will create time slots internally
      sessionConfig: session.config,
      subjectTeacherMap,
      algorithm: selectedAlgorithm,
      progressCallback: (progress, step) => {
        logger.info('[SESSION GENERATE PROGRESS]', { progress: progress?.toFixed(1), step });
      }
    });

    logger.info('[SESSION GENERATE] Generation completed', {
      success: generationResult.success,
      hasSolution: !!generationResult.solution
    });

    if (!generationResult.success || !generationResult.solution || generationResult.solution.length === 0) {
      // Update session status to ready
      await TimetableSession.findByIdAndUpdate(sessionId, {
        status: 'ready',
        config: { ...session.config, lastError: generationResult.reason }
      });

      return res.status(400).json({
        success: false,
        message: 'Failed to generate timetable',
        reason: generationResult.reason || 'No feasible solution found'
      });
    }

    // Step 6: Use validation from generator (already done in generator utility)
    const validationResult = {
      passed: generationResult.conflicts?.filter(c => c.severity === 'critical').length === 0,
      conflicts: generationResult.conflicts || [],
      complianceScore: generationResult.metrics?.qualityMetrics?.constraintCompliance || 100
    };

    // Step 7: Use soft scores from generator
    const softScores = {
      overallScore: generationResult.metrics?.qualityMetrics?.overallScore || 0,
      teacherSatisfaction: generationResult.metrics?.qualityMetrics?.teacherWorkloadBalance || 0,
      roomUtilization: generationResult.metrics?.qualityMetrics?.roomUtilization || 0,
      studentConvenience: generationResult.metrics?.qualityMetrics?.scheduleBalance || 0
    };

    // Step 8: Save timetable to Timetable collection
    logger.info('[SESSION GENERATE] Saving timetable');

    // Create name from session info
    const timetableName = `${session.department} - ${session.year} Year - Sem ${session.semester} - ${session.academicYear}`;

    // Enrich schedule with additional info
    const enrichedSchedule = enrichSchedule(generationResult.solution, teachers, classrooms, courses);

    const timetable = new Timetable({
      name: timetableName,
      sessionId: session._id,
      academicYear: session.academicYear,
      semester: parseInt(session.semester) || 1,
      department: session.department,
      year: session.year ? parseInt(session.year) : undefined,
      status: 'completed',
      generationSettings: {
        algorithm: selectedAlgorithm,
        workingDays: session.config?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: session.config?.startTime || '09:00',
        endTime: session.config?.endTime || '17:00',
        slotDuration: session.config?.slotDuration || 60,
        breakSlots: session.config?.breakSlots || ['12:30-13:30'],
        enforceBreaks: true,
        balanceWorkload: session.config?.compactSchedulePreference !== false
      },
      schedule: enrichedSchedule,
      conflicts: validationResult.conflicts,
      metrics: generationResult.metrics || {},
      quality: {
        overallScore: softScores.overallScore,
        teacherSatisfaction: softScores.teacherSatisfaction,
        roomUtilization: softScores.roomUtilization,
        studentConvenience: softScores.studentConvenience,
        constraintCompliance: validationResult.complianceScore
      },
      statistics: calculateStatistics(generationResult.solution, teachers, classrooms),
      createdBy: req.user?.userId
    });

    await timetable.save();

    logger.info('[SESSION GENERATE] Timetable saved', {
      timetableId: timetable._id,
      sessionId
    });

    // Step 9: Update session status to "generated"
    await TimetableSession.findByIdAndUpdate(sessionId, {
      status: 'generated',
      config: {
        ...session.config,
        lastGeneratedAt: new Date(),
        lastTimetableId: timetable._id.toString()
      }
    });

    logger.info('[SESSION GENERATE] Session status updated to generated', { sessionId });

    res.json({
      success: true,
      message: 'Timetable generated successfully',
      data: {
        timetable: {
          _id: timetable._id,
          name: timetable.name,
          status: timetable.status,
          scheduleCount: timetable.schedule.length,
          quality: timetable.quality,
          metrics: timetable.metrics
        },
        session: {
          _id: session._id,
          status: 'generated'
        },
        validation: {
          hardConstraintsPassed: validationResult.passed,
          conflictsCount: validationResult.conflicts.length,
          complianceScore: validationResult.complianceScore
        },
        softScores
      }
    });

  } catch (error) {
    logger.error('[SESSION GENERATE] Error during generation:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.body.sessionId
    });

    // Try to update session status to indicate failure
    if (req.body.sessionId) {
      try {
        await TimetableSession.findByIdAndUpdate(req.body.sessionId, {
          status: 'ready',
          config: { lastError: error.message }
        });
      } catch (updateError) {
        logger.error('[SESSION GENERATE] Failed to update session status:', updateError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during timetable generation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Validate hard constraints on generated schedule
 */
function validateHardConstraints(schedule, teachers, classrooms, courses) {
  const conflicts = [];
  const teacherSchedule = new Map();
  const roomSchedule = new Map();
  const studentGroupSchedule = new Map();

  for (const slot of schedule) {
    const timeKey = `${slot.day}_${slot.startTime}_${slot.endTime}`;

    // Teacher conflict
    if (teacherSchedule.has(slot.teacherId)) {
      const existing = teacherSchedule.get(slot.teacherId);
      if (existing.day === slot.day && timeOverlaps(existing.startTime, existing.endTime, slot.startTime, slot.endTime)) {
        conflicts.push({
          type: 'teacher_conflict',
          severity: 'critical',
          description: `Teacher ${slot.teacherName} is double-booked`,
          involvedEntities: { teachers: [slot.teacherId], timeSlot: timeKey }
        });
      }
    }
    teacherSchedule.set(slot.teacherId, slot);

    // Room conflict
    if (roomSchedule.has(slot.classroomId)) {
      const existing = roomSchedule.get(slot.classroomId);
      if (existing.day === slot.day && timeOverlaps(existing.startTime, existing.endTime, slot.startTime, slot.endTime)) {
        conflicts.push({
          type: 'room_conflict',
          severity: 'critical',
          description: `Room ${slot.classroomName} is double-booked`,
          involvedEntities: { classrooms: [slot.classroomId], timeSlot: timeKey }
        });
      }
    }
    roomSchedule.set(slot.classroomId, slot);

    // Student group conflict (division or program)
    const studentGroupKey = slot.divisionId || slot.program;
    if (studentGroupKey && studentGroupSchedule.has(studentGroupKey)) {
      const existing = studentGroupSchedule.get(studentGroupKey);
      if (existing.day === slot.day && timeOverlaps(existing.startTime, existing.endTime, slot.startTime, slot.endTime)) {
        conflicts.push({
          type: 'student_conflict',
          severity: 'critical',
          description: `Student group ${studentGroupKey} has overlapping classes`,
          involvedEntities: { courses: [slot.courseId, existing.courseId], timeSlot: timeKey }
        });
      }
    }
    if (studentGroupKey) {
      studentGroupSchedule.set(studentGroupKey, slot);
    }
  }

  return {
    passed: conflicts.filter(c => c.severity === 'critical').length === 0,
    conflicts,
    complianceScore: schedule.length > 0 ? Math.max(0, 100 - (conflicts.length * 10)) : 0
  };
}

/**
 * Calculate soft scores for the schedule
 */
function calculateSoftScores(schedule, teachers, classrooms, courses, config) {
  // Calculate room utilization
  const roomUsage = new Map();
  schedule.forEach(slot => {
    roomUsage.set(slot.classroomId, (roomUsage.get(slot.classroomId) || 0) + 1);
  });
  const roomUtilization = classrooms.length > 0 
    ? (Array.from(roomUsage.values()).reduce((a, b) => a + b, 0) / (classrooms.length * 40)) * 100
    : 0;

  // Calculate teacher workload balance
  const teacherHours = new Map();
  schedule.forEach(slot => {
    teacherHours.set(slot.teacherId, (teacherHours.get(slot.teacherId) || 0) + 1);
  });
  const hours = Array.from(teacherHours.values());
  const avgHours = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  const variance = hours.length > 0 
    ? hours.reduce((sum, h) => sum + Math.pow(h - avgHours, 2), 0) / hours.length 
    : 0;
  const stdDev = Math.sqrt(variance);
  const workloadBalance = avgHours > 0 ? Math.max(0, 100 - (stdDev / avgHours * 100)) : 100;

  // Calculate student convenience
  const studentConvenience = 85; // Placeholder

  // Teacher satisfaction
  const teacherSatisfaction = Math.min(100, workloadBalance + 20);

  // Overall score
  const overallScore = Math.round((roomUtilization * 0.3 + teacherSatisfaction * 0.4 + studentConvenience * 0.3));

  return {
    overallScore,
    teacherSatisfaction: Math.round(teacherSatisfaction),
    roomUtilization: Math.round(Math.min(100, roomUtilization)),
    studentConvenience: Math.round(studentConvenience),
    workloadBalance: Math.round(workloadBalance)
  };
}

/**
 * Enrich schedule with additional info
 */
function enrichSchedule(solution, teachers, classrooms, courses) {
  const teacherMap = new Map(teachers.map(t => [t._id?.toString() || t.id, t]));
  const classroomMap = new Map(classrooms.map(c => [c._id?.toString() || c.id, c]));
  const courseMap = new Map(courses.map(c => [c._id?.toString() || c.id, c]));

  return solution.map(slot => {
    const teacher = teacherMap.get(slot.teacherId?.toString() || slot.teacherId);
    const classroom = classroomMap.get(slot.classroomId?.toString() || slot.classroomId);
    const course = courseMap.get(slot.courseId?.toString() || slot.courseId);

    return {
      ...slot,
      teacherName: slot.teacherName || teacher?.name || '',
      classroomName: slot.classroomName || classroom?.name || '',
      courseName: slot.courseName || course?.name || '',
      courseCode: slot.courseCode || course?.code || '',
      studentCount: slot.studentCount || course?.enrolledStudents || 0
    };
  });
}

/**
 * Calculate timetable statistics
 */
function calculateStatistics(schedule, teachers, classrooms) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const stats = {
    totalClasses: schedule.length,
    totalTeachers: new Set(schedule.map(s => s.teacherId)).size,
    totalRooms: new Set(schedule.map(s => s.classroomId)).size,
    totalHours: schedule.length,
    utilizationByDay: {},
    peakHours: [],
    roomUtilizationRate: 0,
    teacherWorkloadDistribution: {}
  };

  // Utilization by day
  days.forEach(day => {
    stats.utilizationByDay[day.toLowerCase()] = schedule.filter(s => s.day === day).length;
  });

  // Peak hours
  const hourCounts = {};
  schedule.forEach(slot => {
    const hour = slot.startTime.split(':')[0];
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(hourCounts));
  stats.peakHours = Object.keys(hourCounts).filter(h => hourCounts[h] === maxCount).map(h => `${h}:00`);

  // Room utilization
  stats.roomUtilizationRate = classrooms.length > 0 
    ? (schedule.length / (classrooms.length * days.length * 8)) * 100 
    : 0;

  // Teacher workload
  const teacherHours = {};
  schedule.forEach(slot => {
    teacherHours[slot.teacherId] = (teacherHours[slot.teacherId] || 0) + 1;
  });
  stats.teacherWorkloadDistribution = teacherHours;

  return stats;
}

/**
 * Helper to check time overlap
 */
function timeOverlaps(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

module.exports = router;