const OptimizationEngine = require('../algorithms/OptimizationEngine');
const logger = require('./logger');
const { Timetable, TimetableSession } = require('./mongooseToPrisma');

/**
 * Timetable Generator Utility
 * 
 * Provides a strict generation contract for timetable generation.
 * All generation should go through this utility to ensure consistent
 * constraint handling and metric storage.
 * 
 * @param {Object} params - Generation parameters
 * @param {Array} params.teachers - List of teachers
 * @param {Array} params.subjects - List of subjects/courses
 * @param {Array} params.sections - List of sections/divisions
 * @param {Array} params.rooms - List of classrooms
 * @param {Array} params.timeSlots - Pre-generated time slots
 * @param {Object} params.sessionConfig - Session configuration from TimetableSession
 * @param {Object} params.subjectTeacherMap - Explicit mapping of subject to teachers
 * @param {string} params.algorithm - Algorithm to use (greedy, csp, genetic, hybrid, etc.)
 * @param {Function} params.progressCallback - Optional progress callback
 * 
 * @returns {Object} Generation result with solution and metrics
 */
async function generateTimetable({
  teachers,
  subjects,
  sections,
  rooms,
  timeSlots,
  sessionConfig,
  subjectTeacherMap,
  algorithm = 'hybrid',
  progressCallback = null
}) {
  const startTime = Date.now();
  
  logger.info('[GENERATOR] Starting timetable generation with strict contract');
  logger.info('[GENERATOR] Input summary:', {
    teachers: teachers.length,
    subjects: subjects.length,
    sections: sections?.length || 0,
    rooms: rooms.length,
    timeSlots: timeSlots?.length || 0,
    algorithm
  });

  try {
    // Step 1: Validate all inputs
    const validation = validateInputs({
      teachers,
      subjects,
      sections,
      rooms,
      timeSlots,
      sessionConfig,
      subjectTeacherMap
    });

    if (!validation.valid) {
      logger.error('[GENERATOR] Validation failed:', validation.errors);
      return {
        success: false,
        reason: validation.errors.join('; '),
        errors: validation.errors
      };
    }

    // Step 2: Prepare algorithm settings from session config
    const settings = prepareSettings({
      sessionConfig,
      algorithm,
      timeSlots,
      subjectTeacherMap
    });

    logger.info('[GENERATOR] Settings prepared:', {
      algorithm: settings.algorithm,
      workingDays: settings.workingDays,
      startTime: settings.startTime,
      endTime: settings.endTime,
      maxHoursPerDay: settings.maxHoursPerDay,
      maxConsecutiveHours: settings.maxConsecutiveHours,
      breakSlots: settings.breakSlots?.length
    });

    // Step 3: Run optimization through OptimizationEngine
    const optimizationEngine = new OptimizationEngine();
    
    const result = await optimizationEngine.optimize(
      teachers,
      rooms,
      subjects,
      settings,
      progressCallback
    );

    if (!result.success || !result.solution) {
      logger.error('[GENERATOR] Optimization failed:', result.reason);
      return {
        success: false,
        reason: result.reason || 'No solution found'
      };
    }

    // Step 4: Validate hard constraints on the solution
    logger.info('[GENERATOR] Validating hard constraints on generated solution');
    const constraintValidation = validateHardConstraints(
      result.solution,
      teachers,
      rooms,
      subjects,
      sections,
      sessionConfig
    );

    // Step 5: Calculate comprehensive metrics
    logger.info('[GENERATOR] Calculating metrics');
    const metrics = calculateMetrics({
      solution: result.solution,
      teachers,
      rooms,
      subjects,
      startTime,
      sessionConfig
    });

    // Add constraint validation results to metrics
    metrics.constraintValidation = constraintValidation;
    metrics.algorithmUsed = algorithm;

    logger.info('[GENERATOR] Generation completed successfully', {
      scheduledSlots: result.solution.length,
      conflicts: constraintValidation.conflicts.length,
      overallScore: metrics.qualityMetrics?.overallScore
    });

    return {
      success: true,
      solution: result.solution,
      metrics,
      conflicts: constraintValidation.conflicts,
      warnings: constraintValidation.warnings
    };

  } catch (error) {
    logger.error('[GENERATOR] Error during generation:', error);
    return {
      success: false,
      reason: error.message,
      error: error.stack
    };
  }
}

/**
 * Validate all inputs for generation
 */
function validateInputs({ teachers, subjects, sections, rooms, timeSlots, sessionConfig, subjectTeacherMap }) {
  const errors = [];

  if (!teachers || teachers.length === 0) {
    errors.push('No teachers provided');
  }

  if (!subjects || subjects.length === 0) {
    errors.push('No subjects/courses provided');
  }

  if (!rooms || rooms.length === 0) {
    errors.push('No rooms/classrooms provided');
  }

  // Validate each subject has teacher assignments
  subjects.forEach(subject => {
    const teachersForSubject = subjectTeacherMap?.[subject._id?.toString()] || 
                               subject.assignedTeachers?.map(at => at.teacherId) || [];
    if (teachersForSubject.length === 0) {
      errors.push(`Subject ${subject.name} has no teachers assigned`);
    }
  });

  // Validate room capacities
  rooms.forEach(room => {
    if (!room.capacity || room.capacity < 1) {
      errors.push(`Room ${room.name} has invalid capacity`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Prepare algorithm settings from session config
 */
function prepareSettings({ sessionConfig, algorithm, timeSlots, subjectTeacherMap }) {
  const config = sessionConfig || {};
  
  return {
    algorithm: algorithm || 'hybrid',
    
    // Working days and hours
    workingDays: config.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: config.startTime || '09:00',
    endTime: config.endTime || '17:00',
    slotDuration: config.slotDuration || 60,
    
    // Constraint settings
    maxHoursPerDay: config.maxHoursPerDay || 8,
    maxConsecutiveHours: config.maxConsecutiveHours || 3,
    breakMinutes: config.breakMinutes || 15,
    breakSlots: config.breakSlots || ['12:30-13:30'],
    
    // Preference settings
    sameBuildingPreference: config.sameBuildingPreference !== false,
    compactSchedulePreference: config.compactSchedulePreference !== false,
    allowBackToBackLabs: config.allowBackToBackLabs || false,
    
    // Teacher-subject mapping for explicit assignment
    teacherSubjectMap: subjectTeacherMap,
    
    // Optimization settings
    enforceBreaks: true,
    balanceWorkload: config.compactSchedulePreference !== false,
    optimizationGoals: ['minimize_conflicts', 'balanced_schedule']
  };
}

/**
 * Validate hard constraints on generated solution
 */
function validateHardConstraints(solution, teachers, rooms, subjects, sections, sessionConfig) {
  const conflicts = [];
  const warnings = [];
  
  const config = sessionConfig || {};
  const maxHoursPerDay = config.maxHoursPerDay || 8;
  const maxConsecutiveHours = config.maxConsecutiveHours || 3;
  
  // Build lookup maps
  const teacherMap = new Map(teachers.map(t => [t._id?.toString() || t.id, t]));
  const roomMap = new Map(rooms.map(r => [r._id?.toString() || r.id, r]));
  const sectionMap = new Map((sections || []).map(s => [s._id?.toString() || s.id, s]));
  
  // Track teacher daily hours
  const teacherDailyHours = new Map();
  // Track teacher consecutive hours
  const teacherConsecutiveHours = new Map();
  // Track room usage
  const roomSchedule = new Map();
  // Track section schedule
  const sectionSchedule = new Map();
  
  // Sort solution by time to process in order
  const sortedSolution = [...solution].sort((a, b) => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCompare = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayCompare !== 0) return dayCompare;
    return a.startTime.localeCompare(b.startTime);
  });
  
  for (const slot of sortedSolution) {
    const timeKey = `${slot.day}_${slot.startTime}`;
    
    // 1. Teacher conflict check
    if (teacherSchedule.has(`${slot.teacherId}_${timeKey}`)) {
      conflicts.push({
        type: 'teacher_conflict',
        severity: 'critical',
        description: `Teacher ${slot.teacherName} is double-booked at ${slot.day} ${slot.startTime}`,
        slot
      });
    }
    teacherSchedule.set(`${slot.teacherId}_${timeKey}`, slot);
    
    // 2. Room conflict check
    if (roomSchedule.has(`${slot.classroomId}_${timeKey}`)) {
      conflicts.push({
        type: 'room_conflict',
        severity: 'critical',
        description: `Room ${slot.classroomName} is double-booked at ${slot.day} ${slot.startTime}`,
        slot
      });
    }
    roomSchedule.set(`${slot.classroomId}_${timeKey}`, slot);
    
    // 3. Section/student conflict check
    const sectionKey = slot.divisionId || slot.program;
    if (sectionKey && sectionSchedule.has(`${sectionKey}_${timeKey}`)) {
      conflicts.push({
        type: 'student_conflict',
        severity: 'critical',
        description: `Section ${sectionKey} has overlapping classes at ${slot.day} ${slot.startTime}`,
        slot
      });
    }
    if (sectionKey) {
      sectionSchedule.set(`${sectionKey}_${timeKey}`, slot);
    }
    
    // 4. Check max hours per day for teachers
    const teacherDayKey = `${slot.teacherId}_${slot.day}`;
    const currentDayHours = teacherDailyHours.get(teacherDayKey) || 0;
    const slotDuration = parseDuration(slot.startTime, slot.endTime);
    const newDayHours = currentDayHours + slotDuration;
    
    if (newDayHours > maxHoursPerDay) {
      warnings.push({
        type: 'max_hours_per_day',
        severity: 'medium',
        description: `Teacher ${slot.teacherName} exceeds max hours per day (${newDayHours}h > ${maxHoursPerDay}h)`,
        slot
      });
    }
    teacherDailyHours.set(teacherDayKey, newDayHours);
    
    // 5. Check room capacity
    const room = roomMap.get(slot.classroomId?.toString() || slot.classroomId);
    if (room && slot.studentCount > room.capacity) {
      conflicts.push({
        type: 'room_capacity',
        severity: 'critical',
        description: `Room ${room.name} capacity exceeded (${slot.studentCount} > ${room.capacity})`,
        slot
      });
    }
    
    // 6. Check same building preference (if configured)
    if (config.sameBuildingPreference) {
      // This would require tracking building assignments - placeholder for now
    }
  }
  
  return {
    passed: conflicts.filter(c => c.severity === 'critical').length === 0,
    conflicts,
    warnings,
    totalConflicts: conflicts.length,
    totalWarnings: warnings.length
  };
}

/**
 * Calculate comprehensive metrics for the generated timetable
 */
function calculateMetrics({ solution, teachers, rooms, subjects, startTime, sessionConfig }) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Basic statistics
  const stats = {
    totalSlots: solution.length,
    uniqueTeachers: new Set(solution.map(s => s.teacherId)).size,
    uniqueRooms: new Set(solution.map(s => s.classroomId)).size,
    duration,
    durationFormatted: `${(duration / 1000).toFixed(2)}s`
  };
  
  // Calculate utilization
  const roomUsage = new Map();
  const teacherHours = new Map();
  const dayDistribution = {};
  
  for (const slot of solution) {
    // Room usage
    roomUsage.set(slot.classroomId, (roomUsage.get(slot.classroomId) || 0) + 1);
    
    // Teacher hours
    const hours = parseDuration(slot.startTime, slot.endTime);
    teacherHours.set(slot.teacherId, (teacherHours.get(slot.teacherId) || 0) + hours);
    
    // Day distribution
    dayDistribution[slot.day] = (dayDistribution[slot.day] || 0) + 1;
  }
  
  stats.roomUtilization = rooms.length > 0 
    ? Array.from(roomUsage.values()).reduce((a, b) => a + b, 0) / (rooms.length * 40) * 100 
    : 0;
    
  stats.avgTeacherHours = teacherHours.size > 0 
    ? Array.from(teacherHours.values()).reduce((a, b) => a + b, 0) / teacherHours.size 
    : 0;
    
  stats.dayDistribution = dayDistribution;
  
  // Quality metrics
  const qualityMetrics = {
    overallScore: calculateOverallScore(stats, solution),
    roomUtilization: Math.min(100, stats.roomUtilization),
    teacherWorkloadBalance: calculateWorkloadBalance(teacherHours),
    scheduleBalance: calculateScheduleBalance(dayDistribution),
    constraintCompliance: 100 // Will be updated based on validation
  };
  
  return {
    stats,
    qualityMetrics,
    teacherWorkload: Object.fromEntries(teacherHours),
    roomUsage: Object.fromEntries(roomUsage)
  };
}

/**
 * Calculate overall quality score
 */
function calculateOverallScore(stats, solution) {
  if (solution.length === 0) return 0;
  
  const roomScore = Math.min(100, stats.roomUtilization);
  const workloadScore = stats.avgTeacherHours > 0 ? Math.min(100, (stats.avgTeacherHours / 6) * 100) : 50;
  
  return Math.round((roomScore * 0.4 + workloadScore * 0.6));
}

/**
 * Calculate teacher workload balance
 */
function calculateWorkloadBalance(teacherHours) {
  if (teacherHours.size === 0) return 100;
  
  const hours = Array.from(teacherHours.values());
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  
  if (avg === 0) return 100;
  
  const variance = hours.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hours.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.max(0, Math.round(100 - (stdDev / avg * 100)));
}

/**
 * Calculate schedule balance across days
 */
function calculateScheduleBalance(dayDistribution) {
  const days = Object.values(dayDistribution);
  if (days.length === 0) return 100;
  
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  if (avg === 0) return 100;
  
  const variance = days.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / days.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.max(0, Math.round(100 - (stdDev / avg * 100)));
}

/**
 * Helper to parse duration between time strings
 */
function parseDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
}

/**
 * Save generated timetable to database
 */
async function saveTimetable(sessionId, generationResult, userId) {
  const { solution, metrics, conflicts } = generationResult;
  
  const session = await TimetableSession.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const timetable = new Timetable({
    name: `${session.department} - ${session.year} Year - Sem ${session.semester} - ${session.academicYear}`,
    sessionId: session._id,
    academicYear: session.academicYear,
    semester: parseInt(session.semester) || 1,
    department: session.department,
    year: session.year ? parseInt(session.year) : undefined,
    status: 'completed',
    generationSettings: {
      algorithm: metrics.algorithmUsed || 'hybrid',
      ...session.config
    },
    schedule: solution,
    conflicts: conflicts || [],
    metrics: {
      ...metrics,
      startTime: new Date(),
      endTime: new Date()
    },
    quality: metrics.qualityMetrics,
    createdBy: userId
  });
  
  await timetable.save();
  
  // Update session status
  await TimetableSession.findByIdAndUpdate(sessionId, {
    status: 'generated',
    config: {
      ...session.config,
      lastGeneratedAt: new Date(),
      lastTimetableId: timetable._id.toString()
    }
  });
  
  return timetable;
}

module.exports = {
  generateTimetable,
  saveTimetable,
  validateInputs,
  validateHardConstraints,
  calculateMetrics
};