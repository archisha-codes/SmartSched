const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Teacher, Timetable, Classroom, Course, Student, Program } = require('./mongooseToPrisma');

/**
 * AI-Powered Chatbot Service with Google Gemini Integration
 * Provides intelligent responses to user queries about timetables, teachers, students, rooms, etc.
 */
class AIChatbotService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.useAI = !!this.geminiApiKey;
    
    if (this.useAI) {
      try {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
        // Use gemini-1.5-flash for faster responses, or gemini-1.5-pro for better quality
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('✅ Gemini AI initialized successfully with gemini-1.5-flash');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error.message);
        this.useAI = false;
      }
    } else {
      console.warn('⚠️ Gemini API key not found. Chatbot will use rule-based responses.');
    }
  }

  /**
   * Main message processing function
   */
  async processMessage(message, userRole, userId) {
    const lowerMessage = message.toLowerCase().trim();

    try {
      // Gather context data from database
      const context = await this.gatherContext(lowerMessage);

      // If Gemini AI is available, use it for intelligent responses
      if (this.useAI) {
        return await this.generateAIResponse(message, context, userRole, userId);
      }

      // Fallback to rule-based system
      const intent = this.detectIntent(lowerMessage);
      const response = await this.generateResponse(intent, lowerMessage, context, userRole, userId);
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return "I apologize, but I encountered an error. Please try again or rephrase your question.";
    }
  }

  /**
   * Generate AI-powered response using Gemini
   */
  async generateAIResponse(message, context, userRole, userId) {
    try {
      // Build comprehensive context for AI
      const systemPrompt = this.buildSystemPrompt(context, userRole);
      const fullPrompt = `${systemPrompt}\n\nUser Query: ${message}\n\nProvide a helpful, accurate response based on the data above. Use emojis and format nicely.`;

      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return text || this.getFallbackResponse(message, context, userRole, userId);
    } catch (error) {
      console.error('Gemini AI error:', error.message || error);
      // Always fallback to rule-based system if AI fails
      return this.getFallbackResponse(message, context, userRole, userId);
    }
  }

  /**
   * Fallback to rule-based response system
   */
  async getFallbackResponse(message, context, userRole, userId) {
    const lowerMessage = message.toLowerCase();
    const intent = this.detectIntent(lowerMessage);
    return await this.generateResponse(intent, lowerMessage, context, userRole, userId);
  }

  /**
   * Build comprehensive system prompt with all available data
   */
  buildSystemPrompt(context, userRole) {
    let prompt = `You are an intelligent AI assistant for a College Timetable Management System. You help ${userRole}s with their queries.\n\n`;
    
    prompt += `=== SYSTEM INFORMATION ===\n`;
    prompt += `Current Date & Time: ${new Date().toLocaleString()}\n`;
    prompt += `Current Day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]}\n\n`;

    // Add counts
    if (context.counts) {
      prompt += `=== DATABASE STATISTICS ===\n`;
      prompt += `Total Teachers: ${context.counts.teachers}\n`;
      prompt += `Total Students: ${context.counts.students}\n`;
      prompt += `Total Classrooms: ${context.counts.classrooms}\n`;
      prompt += `Total Courses: ${context.counts.courses}\n\n`;
    }

    // Add teacher data
    if (context.teachers && context.teachers.length > 0) {
      prompt += `=== TEACHERS (${context.teachers.length} total) ===\n`;
      context.teachers.forEach((teacher, idx) => {
        prompt += `${idx + 1}. ${teacher.name} (${teacher.designation})\n`;
        prompt += `   Email: ${teacher.email}\n`;
        prompt += `   Department: ${teacher.department}\n`;
        if (teacher.subjects && teacher.subjects.length > 0) {
          prompt += `   Subjects: ${teacher.subjects.join(', ')}\n`;
        }
      });
      prompt += '\n';
    }

    // Add student data
    if (context.students && context.students.length > 0) {
      prompt += `=== STUDENTS (${context.students.length} total) ===\n`;
      context.students.forEach((student, idx) => {
        prompt += `${idx + 1}. ${student.name}\n`;
        prompt += `   Email: ${student.email}\n`;
        prompt += `   Roll No: ${student.rollNumber || 'N/A'}\n`;
        prompt += `   Division: ${student.division || 'N/A'}\n`;
        prompt += `   Program: ${student.program || 'N/A'}\n`;
      });
      prompt += '\n';
    }

    // Add classroom data
    if (context.classrooms && context.classrooms.length > 0) {
      prompt += `=== CLASSROOMS (${context.classrooms.length} total) ===\n`;
      context.classrooms.forEach((room, idx) => {
        prompt += `${idx + 1}. Room ${room.roomNumber} (${room.building})\n`;
        prompt += `   Capacity: ${room.capacity} students\n`;
        if (room.features && room.features.length > 0) {
          prompt += `   Features: ${room.features.join(', ')}\n`;
        }
      });
      prompt += '\n';
    }

    // Add course data
    if (context.courses && context.courses.length > 0) {
      prompt += `=== COURSES (${context.courses.length} total) ===\n`;
      context.courses.forEach((course, idx) => {
        prompt += `${idx + 1}. ${course.code}: ${course.name}\n`;
        prompt += `   Department: ${course.department || 'N/A'}\n`;
        prompt += `   Credits: ${course.credits || 'N/A'}, Type: ${course.type || 'N/A'}\n`;
      });
      prompt += '\n';
    }

    // Add timetable data
    if (context.timetable) {
      prompt += `=== ACTIVE TIMETABLE ===\n`;
      prompt += `Name: ${context.timetable.name}\n`;
      prompt += `Semester: ${context.timetable.semester}, Year: ${context.timetable.year}\n`;
      prompt += `Academic Year: ${context.timetable.academicYear}\n`;
      prompt += `Department: ${context.timetable.department}\n`;
      prompt += `Total Classes: ${context.timetable.schedule.length}\n`;
      prompt += `Status: ${context.timetable.status}\n`;
      if (context.timetable.publishedAt) {
        prompt += `Published: ${new Date(context.timetable.publishedAt).toLocaleString()}\n`;
      }
      prompt += '\n';

      // Add complete schedule information
      if (context.timetable.schedule && context.timetable.schedule.length > 0) {
        prompt += `=== FULL TIMETABLE SCHEDULE ===\n`;
        
        const scheduleByDay = {};
        context.timetable.schedule.forEach(slot => {
          const day = slot.day || 'Unknown';
          if (!scheduleByDay[day]) scheduleByDay[day] = [];
          scheduleByDay[day].push(slot);
        });

        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayOrder.forEach(day => {
          if (scheduleByDay[day]) {
            prompt += `\n--- ${day.toUpperCase()} ---\n`;
            scheduleByDay[day]
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .forEach((slot, idx) => {
                prompt += `${idx + 1}. ${slot.startTime}-${slot.endTime}\n`;
                prompt += `   Course: ${slot.courseName || slot.courseCode || 'N/A'}\n`;
                prompt += `   Teacher: ${slot.teacherName || 'N/A'} (ID: ${slot.teacherId || 'N/A'})\n`;
                prompt += `   Room: ${slot.classroomName || 'N/A'} (ID: ${slot.classroomId || 'N/A'})\n`;
                prompt += `   Type: ${slot.sessionType || 'N/A'}\n`;
                if (slot.batchId || slot.divisionId) {
                  prompt += `   Batch/Division: ${slot.batchId || slot.divisionId}\n`;
                }
                if (slot.studentCount) {
                  prompt += `   Students: ${slot.studentCount}\n`;
                }
              });
          }
        });
        prompt += '\n';
      }

      // Add today's schedule if available
      const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
      const todayClasses = context.timetable.schedule.filter(s => s.day === today);
      
      if (todayClasses.length > 0) {
        prompt += `=== TODAY'S SCHEDULE (${today.toUpperCase()}) ===\n`;
        todayClasses
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .forEach((cls, idx) => {
            prompt += `${idx + 1}. ${cls.startTime}-${cls.endTime}: ${cls.courseName || cls.courseCode}\n`;
            prompt += `   Teacher: ${cls.teacherName || 'TBA'}\n`;
            prompt += `   Room: ${cls.classroomName || 'TBA'}\n`;
            if (cls.sessionType) prompt += `   Type: ${cls.sessionType}\n`;
          });
        prompt += '\n';
      }
    } else {
      prompt += `=== TIMETABLE STATUS ===\n`;
      prompt += `No published timetable available currently.\n\n`;
    }

    prompt += `=== YOUR CAPABILITIES ===\n`;
    prompt += `You can help with:\n`;
    prompt += `1. Finding teacher locations in real-time\n`;
    prompt += `2. Listing all teachers, students, courses, and classrooms\n`;
    prompt += `3. Checking room availability\n`;
    prompt += `4. Showing schedules and timetables\n`;
    prompt += `5. Providing timetable optimization guidance\n`;
    prompt += `6. Answering questions about the system\n\n`;

    prompt += `=== RESPONSE GUIDELINES ===\n`;
    prompt += `1. Be helpful, friendly, and concise\n`;
    prompt += `2. Use emojis to make responses engaging (👨‍🏫 📚 🏫 📅 etc.)\n`;
    prompt += `3. Format lists with numbers or bullets\n`;
    prompt += `4. If asked about location, check the timetable schedule for current time\n`;
    prompt += `5. If data is missing, politely inform the user\n`;
    prompt += `6. For "show all" queries, display complete lists from the data above\n`;
    prompt += `7. Be specific and accurate - use the exact data provided\n\n`;

    return prompt;
  }

  /**
   * Detect user intent from message
   */
  detectIntent(message) {
    const msg = message.toLowerCase();
    
    // Priority-based intent detection (more specific patterns first)
    
    // Teacher location (highest priority for "where is" queries)
    if (/\b(where is|where's|where are|find|locate|location of|position of)\b.*\b(teacher|professor|dr\.|mr\.|ms\.|mrs\.|faculty|sir|ma'am|mam)\b/i.test(message)) {
      return 'teacherLocation';
    }
    
    // Free teachers
    if (/\b(free|available|vacant)\b.*\b(teacher|faculty|professor|instructor)s?\b/i.test(message) ||
        /\b(teacher|faculty|professor)s?\b.*\b(free|available|vacant)\b/i.test(message)) {
      return 'freeTeachers';
    }
    
    // Room availability
    if (/\b(room|classroom|lab|laboratory|hall|auditorium)s?\b.*\b(available|free|vacant|empty)\b/i.test(message) ||
        /\b(available|free|vacant|empty)\b.*\b(room|classroom|lab|hall)s?\b/i.test(message) ||
        /\b(which|show|list)\b.*\b(room|classroom|lab)s?\b.*\b(free|available)\b/i.test(message)) {
      return 'roomAvailability';
    }
    
    // Schedule queries
    if (/\b(my|show my|display my|get my)\b.*\b(schedule|timetable|class|routine)\b/i.test(message) ||
        /\b(schedule|timetable|routine)\b.*\b(today|tomorrow|this week)\b/i.test(message) ||
        /\b(when|what time)\b.*\b(class|lecture|lab)\b/i.test(message)) {
      return 'schedule';
    }
    
    // Teacher list
    if (/\b(show|list|display|all|get|view|see)\b.*\b(teacher|faculty|professor|instructor)s?\b/i.test(message) ||
        /\b(teacher|faculty|professor)s?\b.*\b(list|all)\b/i.test(message)) {
      return 'teacherList';
    }
    
    // Student list
    if (/\b(show|list|display|all|get|view|see)\b.*\b(student)s?\b/i.test(message) ||
        /\b(student)s?\b.*\b(list|all)\b/i.test(message)) {
      return 'studentList';
    }
    
    // Course list
    if (/\b(show|list|display|all|get|view|see)\b.*\b(course|subject|class|module)s?\b/i.test(message) ||
        /\b(course|subject)s?\b.*\b(list|all|available)\b/i.test(message) ||
        /\bwhat\b.*\b(course|subject)s?\b/i.test(message)) {
      return 'courseList';
    }
    
    // Timetable info
    if (/\b(timetable|time table)\b.*\b(info|information|status|details|published|active|current)\b/i.test(message) ||
        /\b(show|display|view)\b.*\b(timetable|time table)\b/i.test(message)) {
      return 'timetableInfo';
    }
    
    // Optimization queries
    if (/\b(optimi[sz]e|optimi[sz]ation|algorithm|genetic|ga|improve|enhancement|efficiency|performance)\b/i.test(message)) {
      return 'optimization';
    }
    
    // Greeting
    if (/^(hello|hi|hey|greetings|good morning|good afternoon|good evening|namaste|hola)[\s!?,.]*$/i.test(message)) {
      return 'greeting';
    }
    
    // Thanks
    if (/\b(thank you|thanks|thank|appreciate|grateful|thx)\b/i.test(message)) {
      return 'thanks';
    }
    
    // Help
    if (/\b(help|assist|support|guide|how to|what can you)\b/i.test(message)) {
      return 'help';
    }

    return 'general';
  }

  /**
   * Gather relevant context data based on message
   */
  async gatherContext(message) {
    const context = {};

    try {
      // Always fetch basic counts
      const [teacherCount, studentCount, classroomCount, courseCount] = await Promise.all([
        Teacher.countDocuments({ status: 'active' }),
        Student.countDocuments({}),
        Classroom.countDocuments({}),
        Course.countDocuments({})
      ]);

      context.counts = {
        teachers: teacherCount,
        students: studentCount,
        classrooms: classroomCount,
        courses: courseCount
      };

      // Fetch teachers if query mentions them
      if (message.includes('teacher') || message.includes('faculty') || message.includes('professor')) {
        context.teachers = await Teacher.find({ status: 'active' })
          .select('name email department designation subjects')
          .limit(100)
          .lean();
      }

      // Fetch students if query mentions them
      if (message.includes('student')) {
        context.students = await Student.find({})
          .select('name email rollNumber division program')
          .limit(100)
          .lean();
      }

      // Fetch classrooms if query mentions rooms
      if (message.includes('room') || message.includes('classroom') || message.includes('lab')) {
        context.classrooms = await Classroom.find({})
          .select('roomNumber building capacity features')
          .lean();
      }

      // Fetch courses if query mentions courses
      if (message.includes('course') || message.includes('subject')) {
        context.courses = await Course.find({})
          .select('name code department credits type')
          .limit(50)
          .lean();
      }

      // Fetch active timetable - use the most recently published one
      context.timetable = await Timetable.findOne({ 
        status: 'published', 
        isActive: true 
      })
        .sort({ publishedAt: -1 })
        .limit(1)
        .lean();

    } catch (error) {
      console.error('Error gathering context:', error);
    }

    return context;
  }

  /**
   * Generate intelligent response
   */
  async generateResponse(intent, message, context, userRole, userId) {
    switch (intent) {
      case 'greeting':
        return this.handleGreeting(userRole);
      
      case 'thanks':
        return "You're welcome! 😊 Feel free to ask me anything about timetables, teachers, students, or schedules.";
      
      case 'help':
        return this.handleHelp(userRole);
      
      case 'teacherLocation':
        return await this.handleTeacherLocation(message, context);
      
      case 'freeTeachers':
        return await this.handleFreeTeachers(context);
      
      case 'teacherList':
        return this.handleTeacherList(context);
      
      case 'studentList':
        return this.handleStudentList(context);
      
      case 'roomAvailability':
        return await this.handleRoomAvailability(context);
      
      case 'schedule':
        return await this.handleSchedule(userRole, userId, context);
      
      case 'courseList':
        return this.handleCourseList(context);
      
      case 'optimization':
        return this.handleOptimization();
      
      case 'timetableInfo':
        return await this.handleTimetableInfo(context);
      
      default:
        return this.handleGeneral(message, context, userRole);
    }
  }

  /**
   * Handle greeting
   */
  handleGreeting(userRole) {
    const greetings = {
      admin: "Hello! 👋 I'm your AI assistant. As an admin, I can help you with:\n• Viewing all teachers and students\n• Checking room availability\n• Finding free teachers and rooms\n• Timetable management\n• Optimization strategies\n• System insights\n\nWhat would you like to know?",
      faculty: "Hello! 👋 I'm your AI assistant. I can help you with:\n• Finding colleagues and their locations\n• Viewing your teaching schedule\n• Checking which teachers are free\n• Room availability\n• Course information\n• Student lists\n\nHow can I assist you?",
      student: "Hello! 👋 I'm your AI assistant. I can help you with:\n• Your class schedule\n• Finding professors and their locations\n• Room availability\n• Course information\n• Timetable queries\n• Free teacher information\n\nWhat would you like to know?"
    };

    return greetings[userRole] || greetings.student;
  }

  /**
   * Handle help queries
   */
  handleHelp(userRole) {
    let response = `🤖 **AI Chatbot Help Guide**\n\n`;
    response += `I'm here to help you with timetable-related queries!\n\n`;
    
    response += `**📍 Teacher Queries:**\n`;
    response += `• "Where is Dr. Smith?"\n`;
    response += `• "Find Teacher John"\n`;
    response += `• "Location of Professor Kumar"\n`;
    response += `• "Which teachers are free?"\n`;
    response += `• "Show all teachers"\n\n`;
    
    response += `**🏫 Room Queries:**\n`;
    response += `• "Which rooms are available?"\n`;
    response += `• "Show free classrooms"\n`;
    response += `• "Available labs right now"\n`;
    response += `• "Room availability"\n\n`;
    
    response += `**📅 Schedule Queries:**\n`;
    response += `• "My schedule"\n`;
    response += `• "Show my classes today"\n`;
    response += `• "What's my timetable?"\n`;
    response += `• "When is my next class?"\n\n`;
    
    response += `**📚 Information Queries:**\n`;
    response += `• "Show all courses"\n`;
    response += `• "List students"\n`;
    response += `• "Timetable information"\n`;
    response += `• "Show optimization details"\n\n`;
    
    response += `💡 **Tips:**\n`;
    response += `• Ask in natural language\n`;
    response += `• Be specific for better results\n`;
    response += `• Use teacher names for location queries\n`;
    response += `• I understand context and follow-up questions\n\n`;
    
    response += `Need something specific? Just ask! 😊`;
    
    return response;
  }

  /**
   * Handle free teachers query
   */
  async handleFreeTeachers(context) {
    try {
      if (!context.teachers || context.teachers.length === 0) {
        return "❌ No teachers found in the system.";
      }

      if (!context.timetable || !context.timetable.schedule) {
        const teacherList = context.teachers.slice(0, 10)
          .map((t, i) => `${i + 1}. **${t.name}** (${t.department})`)
          .join('\n');
        return `👨‍🏫 **All Teachers:**\n\n${teacherList}\n\n⚠️ (No published timetable to check who's teaching)`;
      }

      // Get current day and time
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Find teachers who are currently teaching
      const busyTeacherIds = new Set();
      const teachingInfo = [];

      context.timetable.schedule.forEach(slot => {
        if (slot.day !== currentDay) return;

        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        const current = this.timeToMinutes(currentTime);

        if (current >= slotStart && current <= slotEnd && slot.teacherId) {
          busyTeacherIds.add(slot.teacherId.toString());
          teachingInfo.push({
            teacherId: slot.teacherId,
            teacherName: slot.teacherName,
            course: slot.courseName || slot.courseCode,
            room: slot.classroomName,
            time: `${slot.startTime}-${slot.endTime}`
          });
        }
      });

      // Categorize teachers
      const freeTeachers = context.teachers.filter(t => !busyTeacherIds.has(t._id.toString()));
      const busyTeachers = teachingInfo;

      let response = `👨‍🏫 **Teacher Availability**\n`;
      response += `📅 ${currentDay}, ⏰ ${currentTime}\n\n`;

      // Show free teachers
      if (freeTeachers.length > 0) {
        response += `✅ **Free Teachers (${freeTeachers.length}):**\n\n`;
        freeTeachers.slice(0, 15).forEach((teacher, idx) => {
          response += `${idx + 1}. **${teacher.name}**\n`;
          response += `   🏢 ${teacher.department}\n`;
          response += `   📧 ${teacher.email}\n`;
          if (teacher.designation) response += `   💼 ${teacher.designation}\n`;
          response += '\n';
        });
        if (freeTeachers.length > 15) {
          response += `... and ${freeTeachers.length - 15} more free\n\n`;
        }
      } else {
        response += `⚠️ All teachers are currently busy.\n\n`;
      }

      // Show busy teachers
      if (busyTeachers.length > 0) {
        response += `🔴 **Currently Teaching (${busyTeachers.length}):**\n`;
        busyTeachers.slice(0, 8).forEach((info, idx) => {
          response += `${idx + 1}. ${info.teacherName} - ${info.course}\n`;
          response += `   📍 ${info.room} | ⏰ ${info.time}\n`;
        });
        if (busyTeachers.length > 8) {
          response += `... and ${busyTeachers.length - 8} more teaching\n`;
        }
      }

      response += `\n📊 **Summary:**\n`;
      response += `   Total: ${context.teachers.length} | Free: ${freeTeachers.length} | Teaching: ${busyTeachers.length}`;

      return response;

    } catch (error) {
      console.error('Error finding free teachers:', error);
      return "❌ I encountered an error checking teacher availability. Please try again.";
    }
  }

  /**
   * Handle teacher location queries
   */
  async handleTeacherLocation(message, context) {
    try {
      // Try to extract teacher name from the message
      const nameMatch = message.match(/(?:where is|where's|find|locate|location of)\s+(?:teacher|professor|dr\.|mr\.|ms\.|faculty)?\s*([a-z\s.]+?)(?:\?|$|right|now|teaching|at)/i);
      
      if (!nameMatch || !nameMatch[1]) {
        if (context.teachers && context.teachers.length > 0) {
          const teacherList = context.teachers.slice(0, 5)
            .map((t, i) => `${i + 1}. ${t.name} (${t.department})`)
            .join('\n');
          return `👨‍🏫 Please specify a teacher's name. Here are some teachers:\n\n${teacherList}\n\nExample: "Where is Dr. Smith?"`;
        }
        return `I couldn't identify the teacher's name. Please try: "Where is [Teacher Name]?"`;
      }

      const searchName = nameMatch[1].trim().toLowerCase();
      
      // Find the teacher - more flexible matching
      const teacher = context.teachers?.find(t => {
        const tName = t.name.toLowerCase();
        return tName.includes(searchName) || searchName.includes(tName.split(' ')[tName.split(' ').length - 1]);
      });

      if (!teacher) {
        const suggestions = context.teachers?.slice(0, 5).map(t => `• ${t.name}`).join('\n') || '';
        return `❌ I couldn't find a teacher named "${nameMatch[1]}"\n\n${suggestions ? 'Did you mean:\n' + suggestions : 'Try "show all teachers" to see the list.'}`;
      }

      // Get current location from timetable
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (!context.timetable || !context.timetable.schedule) {
        return `**${teacher.name}** 👨‍🏫\n\n` +
               `📧 Email: ${teacher.email}\n` +
               `🏢 Department: ${teacher.department}\n` +
               `� Designation: ${teacher.designation || 'Faculty'}\n\n` +
               `⚠️ No published timetable available to check current location.\n` +
               `📍 Likely at: Faculty room, ${teacher.department} department`;
      }

      // Find current class for this teacher
      const currentClass = context.timetable.schedule.find(slot => {
        // Match by teacher ID or teacher name
        const teacherMatch = slot.teacherId === teacher._id.toString() || 
                            slot.teacherName?.toLowerCase().includes(teacher.name.toLowerCase());
        
        if (!teacherMatch) return false;
        if (slot.day !== currentDay) return false;

        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        const current = this.timeToMinutes(currentTime);

        return current >= slotStart && current <= slotEnd;
      });

      if (currentClass) {
        return `📍 **${teacher.name}** is currently teaching:\n\n` +
               `🏫 **Room:** ${currentClass.classroomName || 'TBA'}\n` +
               `📚 **Course:** ${currentClass.courseName || currentClass.courseCode || 'N/A'}\n` +
               `📖 **Type:** ${currentClass.sessionType || 'Lecture'}\n` +
               `⏰ **Time:** ${currentClass.startTime} - ${currentClass.endTime}\n` +
               `👥 **Students:** ${currentClass.studentCount || 'N/A'}\n\n` +
               `✅ You can find them there right now!`;
      }

      // Find next class
      const upcomingClasses = context.timetable.schedule
        .filter(slot => {
          const teacherMatch = slot.teacherId === teacher._id.toString() || 
                              slot.teacherName?.toLowerCase().includes(teacher.name.toLowerCase());
          if (!teacherMatch) return false;
          if (slot.day !== currentDay) return false;
          
          const slotStart = this.timeToMinutes(slot.startTime);
          const current = this.timeToMinutes(currentTime);
          return slotStart > current;
        })
        .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

      const nextClass = upcomingClasses[0];

      if (nextClass) {
        return `**${teacher.name}** 👨‍🏫\n\n` +
               `🏢 Department: ${teacher.department}\n` +
               `📧 Email: ${teacher.email}\n` +
               `💼 ${teacher.designation || 'Faculty'}\n\n` +
               `⏰ **Currently:** Not teaching (Free time)\n` +
               `📍 **Likely at:** Faculty room / Office\n\n` +
               `� **Next Class:**\n` +
               `   🏫 Room: ${nextClass.classroomName || 'TBA'}\n` +
               `   ⏰ Time: ${nextClass.startTime} - ${nextClass.endTime}\n` +
               `   📚 Course: ${nextClass.courseName || nextClass.courseCode}`;
      }

      return `**${teacher.name}** 👨‍🏫\n\n` +
             `🏢 Department: ${teacher.department}\n` +
             `📧 Email: ${teacher.email}\n` +
             `💼 ${teacher.designation || 'Faculty'}\n\n` +
             `✅ **Currently:** Not teaching today\n` +
             `📍 **Likely at:** Faculty room / Office, ${teacher.department} department\n\n` +
             `No more classes scheduled for today.`;

    } catch (error) {
      console.error('Error finding teacher location:', error);
      return "❌ I encountered an error finding the teacher's location. Please try again or rephrase your question.";
    }
  }

  /**
   * Handle teacher list queries
   */
  handleTeacherList(context) {
    if (!context.teachers || context.teachers.length === 0) {
      return "❌ There are no teachers in the system currently.";
    }

    let response = `👨‍🏫 **All Faculty Members** (${context.teachers.length} total):\n\n`;
    
    // Group by department
    const byDepartment = {};
    context.teachers.forEach(teacher => {
      const dept = teacher.department || 'Other';
      if (!byDepartment[dept]) byDepartment[dept] = [];
      byDepartment[dept].push(teacher);
    });

    Object.entries(byDepartment).forEach(([dept, teachers]) => {
      response += `**🏢 ${dept} Department (${teachers.length}):**\n`;
      teachers.slice(0, 10).forEach((teacher, idx) => {
        response += `${idx + 1}. **${teacher.name}**`;
        if (teacher.designation) response += ` - ${teacher.designation}`;
        response += '\n';
        response += `   📧 ${teacher.email}\n`;
        if (teacher.subjects && teacher.subjects.length > 0) {
          response += `   📚 ${teacher.subjects.slice(0, 2).join(', ')}\n`;
        }
      });
      if (teachers.length > 10) {
        response += `   ... and ${teachers.length - 10} more\n`;
      }
      response += '\n';
    });

    response += `💡 **Tip:** Ask "Where is [Teacher Name]?" to find their current location.`;

    return response;
  }

  /**
   * Handle student list queries
   */
  handleStudentList(context) {
    if (!context.students || context.students.length === 0) {
      return "❌ There are no students in the system currently.";
    }

    let response = `👨‍🎓 **Student Directory** (${context.students.length} total):\n\n`;
    
    // Group by division
    const byDivision = {};
    context.students.forEach(student => {
      const div = student.division || 'Unassigned';
      if (!byDivision[div]) byDivision[div] = [];
      byDivision[div].push(student);
    });

    Object.entries(byDivision).forEach(([div, students]) => {
      response += `**📚 Division ${div} (${students.length} students):**\n`;
      students.slice(0, 10).forEach((student, idx) => {
        response += `${idx + 1}. **${student.name}**`;
        if (student.rollNumber) response += ` (Roll: ${student.rollNumber})`;
        response += '\n';
        response += `   � ${student.email}`;
        if (student.program) response += ` | 🎓 ${student.program}`;
        response += '\n';
      });
      if (students.length > 10) {
        response += `   ... and ${students.length - 10} more\n`;
      }
      response += '\n';
    });

    return response;
  }

  /**
   * Handle room availability
   */
  async handleRoomAvailability(context) {
    if (!context.classrooms || context.classrooms.length === 0) {
      return "❌ There are no classrooms in the system.";
    }

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!context.timetable || !context.timetable.schedule) {
      const roomList = context.classrooms.slice(0, 10).map(room =>
        `• **${room.roomNumber}** (${room.building || 'Main Building'}) - Capacity: ${room.capacity}`
      ).join('\n');
      return `🏫 **All Classrooms:**\n\n${roomList}\n\n⚠️ (No published timetable to check occupancy)`;
    }

    const occupiedRooms = new Set();
    const currentClasses = [];
    
    context.timetable.schedule.forEach(slot => {
      if (slot.day === currentDay) {
        const slotStart = this.timeToMinutes(slot.startTime);
        const slotEnd = this.timeToMinutes(slot.endTime);
        const current = this.timeToMinutes(currentTime);

        if (current >= slotStart && current <= slotEnd && slot.classroomId) {
          occupiedRooms.add(slot.classroomId.toString());
          currentClasses.push({
            room: slot.classroomName || 'TBA',
            course: slot.courseName || slot.courseCode || 'N/A',
            teacher: slot.teacherName || 'N/A',
            time: `${slot.startTime}-${slot.endTime}`
          });
        }
      }
    });

    const availableRooms = context.classrooms.filter(room => 
      !occupiedRooms.has(room._id.toString())
    );

    let response = `🏫 **Room Availability**\n`;
    response += `📅 ${currentDay}, ⏰ ${currentTime}\n\n`;

    if (availableRooms.length === 0) {
      response += `⚠️ All ${context.classrooms.length} classrooms are currently occupied.\n\n`;
    } else {
      response += `✅ **Available Rooms (${availableRooms.length}):**\n\n`;
      availableRooms.slice(0, 12).forEach((room, index) => {
        response += `**${index + 1}. ${room.roomNumber}**`;
        if (room.building) response += ` (${room.building})`;
        response += `\n`;
        response += `   👥 Capacity: ${room.capacity}`;
        if (room.type) response += ` | ${room.type}`;
        response += '\n';
        if (room.features && room.features.length > 0) {
          response += `   ✨ ${room.features.slice(0, 3).join(', ')}\n`;
        }
        response += '\n';
      });
      if (availableRooms.length > 12) {
        response += `... and ${availableRooms.length - 12} more available\n\n`;
      }
    }

    if (currentClasses.length > 0) {
      response += `\n🔴 **Occupied Rooms (${currentClasses.length}):**\n`;
      currentClasses.slice(0, 5).forEach((cls, idx) => {
        response += `${idx + 1}. ${cls.room} - ${cls.course} (${cls.teacher})\n`;
      });
      if (currentClasses.length > 5) {
        response += `... and ${currentClasses.length - 5} more\n`;
      }
    }

    response += `\n📊 Utilization: ${Math.round((occupiedRooms.size / context.classrooms.length) * 100)}%`;

    return response;
  }

  /**
   * Handle schedule queries
   */
  async handleSchedule(userRole, userId, context) {
    if (userRole === 'student') {
      const student = await Student.findById(userId);
      if (!student || !context.timetable || !context.timetable.schedule) {
        return "❌ I couldn't retrieve your schedule. Please ensure you're logged in and a timetable is published.";
      }

      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];

      const todayClasses = context.timetable.schedule
        .filter(slot => 
          slot.day === currentDay &&
          (slot.division === student.division || slot.batch === student.batch)
        )
        .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

      if (todayClasses.length === 0) {
        return `📅 **Your Schedule for ${currentDay}:**\n\n🎉 You have no classes today. Enjoy your free day!`;
      }

      let response = `📅 **Your Schedule for ${currentDay}:**\n\n`;
      todayClasses.forEach((cls, index) => {
        response += `**${index + 1}. ${cls.startTime} - ${cls.endTime}**\n`;
        response += `   📚 Course: ${cls.courseName || cls.courseCode || 'N/A'}\n`;
        response += `   👨‍🏫 Teacher: ${cls.teacherName || 'TBA'}\n`;
        response += `   🏫 Room: ${cls.classroomName || 'TBA'}\n`;
        response += `   📖 Type: ${cls.sessionType || 'Lecture'}\n\n`;
      });

      return response;
    }

    if (userRole === 'teacher') {
      const teacher = await Teacher.findById(userId);
      if (!teacher || !context.timetable || !context.timetable.schedule) {
        return "❌ I couldn't retrieve your schedule. Please ensure you're logged in and a timetable is published.";
      }

      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];

      const todayClasses = context.timetable.schedule
        .filter(slot => 
          slot.day === currentDay &&
          (slot.teacherId === teacher._id.toString() || 
           slot.teacherName?.toLowerCase().includes(teacher.name.toLowerCase()))
        )
        .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

      if (todayClasses.length === 0) {
        return `📅 **Your Schedule for ${currentDay}:**\n\n✅ You have no classes today. Office hours or free day!`;
      }

      let response = `📅 **Your Teaching Schedule for ${currentDay}:**\n\n`;
      todayClasses.forEach((cls, index) => {
        response += `**${index + 1}. ${cls.startTime} - ${cls.endTime}**\n`;
        response += `   📚 Course: ${cls.courseName || cls.courseCode || 'N/A'}\n`;
        response += `   🏫 Room: ${cls.classroomName || 'TBA'}\n`;
        response += `   📖 Type: ${cls.sessionType || 'Lecture'}\n`;
        response += `   👥 Students: ${cls.studentCount || 'N/A'}\n\n`;
      });

      return response;
    }

    return "To see a schedule, please specify whose schedule (e.g., 'my schedule' for students/teachers).";
  }

  /**
   * Handle course list
   */
  handleCourseList(context) {
    if (!context.courses || context.courses.length === 0) {
      return "❌ There are no courses in the system.";
    }

    let response = `📚 **Course Catalog** (${context.courses.length} total):\n\n`;
    
    // Group by department
    const byDepartment = {};
    context.courses.forEach(course => {
      const dept = course.department || 'General';
      if (!byDepartment[dept]) byDepartment[dept] = [];
      byDepartment[dept].push(course);
    });

    Object.entries(byDepartment).forEach(([dept, courses]) => {
      response += `**🏢 ${dept} Department (${courses.length} courses):**\n`;
      courses.slice(0, 10).forEach((course, idx) => {
        response += `${idx + 1}. **${course.code}** - ${course.name}\n`;
        if (course.credits) response += `   ⭐ ${course.credits} Credits`;
        if (course.type) response += ` | 📖 ${course.type}`;
        response += '\n';
      });
      if (courses.length > 10) {
        response += `   ... and ${courses.length - 10} more\n`;
      }
      response += '\n';
    });

    return response;
  }

  /**
   * Handle optimization queries
   */
  handleOptimization() {
    return `🎯 **Timetable Optimization Guide:**\n\n` +
           `**1. Genetic Algorithm** 🧬\n` +
           `   • Evolves schedules over generations\n` +
           `   • Best for: Complex constraints\n` +
           `   • Advantages: Global optimization\n\n` +
           `**2. Simulated Annealing** 🌡️\n` +
           `   • Gradually refines solutions\n` +
           `   • Best for: Quick optimization\n` +
           `   • Advantages: Escapes local optima\n\n` +
           `**3. Greedy Algorithm** ⚡\n` +
           `   • Makes optimal choices at each step\n` +
           `   • Best for: Fast generation\n` +
           `   • Advantages: Quick execution\n\n` +
           `**4. Hybrid Approach** 🔄\n` +
           `   • Combines multiple algorithms\n` +
           `   • Best for: Maximum quality\n` +
           `   • Advantages: Best of all methods\n\n` +
           `💡 **Tips:**\n` +
           `• Update teacher availability\n` +
           `• Define clear constraints\n` +
           `• Use larger populations for Genetic Algorithm`;
  }

  /**
   * Handle timetable info
   */
  async handleTimetableInfo(context) {
    if (!context.timetable || !context.timetable.schedule) {
      return "⚠️ **No Published Timetable**\n\nThere is no published timetable currently. Please generate and publish one first.";
    }

    const tt = context.timetable;
    
    // Calculate statistics
    const dayStats = {};
    const roomUsage = new Set();
    const teacherCount = new Set();
    const courseCount = new Set();
    
    tt.schedule.forEach(slot => {
      // Day-wise count
      dayStats[slot.day] = (dayStats[slot.day] || 0) + 1;
      
      // Unique counts
      if (slot.classroomId) roomUsage.add(slot.classroomId.toString());
      if (slot.teacherId) teacherCount.add(slot.teacherId.toString());
      if (slot.courseName || slot.courseCode) courseCount.add(slot.courseName || slot.courseCode);
    });

    let response = `� **Published Timetable Information**\n\n`;
    
    response += `**📋 Basic Details:**\n`;
    response += `• Name: ${tt.name || 'Untitled'}\n`;
    response += `• Semester: ${tt.semester || 'N/A'}\n`;
    response += `• Academic Year: ${tt.academicYear || 'N/A'}\n`;
    response += `• Status: ✅ Published\n`;
    if (tt.publishedAt) {
      response += `• Published: ${new Date(tt.publishedAt).toLocaleString()}\n`;
    }
    response += '\n';

    response += `**📊 Statistics:**\n`;
    response += `• Total Classes: ${tt.schedule.length}\n`;
    response += `• Unique Teachers: ${teacherCount.size}\n`;
    response += `• Unique Courses: ${courseCount.size}\n`;
    response += `• Rooms Used: ${roomUsage.size}\n`;
    response += '\n';

    response += `**📅 Day-wise Distribution:**\n`;
    Object.entries(dayStats)
      .sort((a, b) => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days.indexOf(a[0]) - days.indexOf(b[0]);
      })
      .forEach(([day, count]) => {
        response += `• ${day}: ${count} classes\n`;
      });
    response += '\n';

    if (tt.constraints) {
      response += `**⚙️ Constraints Applied:**\n`;
      response += `• Max Classes/Day: ${tt.constraints.maxClassesPerDay || 'N/A'}\n`;
      response += `• Working Days: ${tt.constraints.workingDays?.join(', ') || 'Mon-Fri'}\n`;
      response += '\n';
    }

    response += `💡 Ask "my schedule" to see your personal timetable!`;

    return response;
  }

  /**
   * Handle general queries
   */
  handleGeneral(message, context, userRole) {
    return `🤖 I'm here to help! You can ask me about:\n\n` +
           `**👨‍🏫 Teachers:**\n` +
           `  • "Show all teachers"\n` +
           `  • "Where is Dr. Smith?"\n` +
           `  • "Which teachers are free?"\n\n` +
           `**👨‍🎓 Students:**\n` +
           `  • "Show all students"\n` +
           `  • "List students by division"\n\n` +
           `**🏫 Rooms:**\n` +
           `  • "Which rooms are free?"\n` +
           `  • "Available classrooms"\n` +
           `  • "Show labs"\n\n` +
           `**📅 Schedule:**\n` +
           `  • "My schedule"\n` +
           `  • "Today's classes"\n` +
           `  • "Show my timetable"\n\n` +
           `**📚 Courses:**\n` +
           `  • "List all courses"\n` +
           `  • "Show subjects"\n\n` +
           `**📊 Information:**\n` +
           `  • "Timetable information"\n` +
           `  • "Show optimization details"\n` +
           `  • "Help"\n\n` +
           `What would you like to know? 😊`;
  }

  /**
   * Convert time string to minutes
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

module.exports = new AIChatbotService();
