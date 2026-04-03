const { PrismaClient } = require('@prisma/client');
const { Teacher, Classroom, Course } = require('./utils/mongooseToPrisma');

async function runTests() {
  console.log('--- Starting API Data Insertion Tests ---');

  let testTeacherId;
  let testClassroomId;

  try {
    // Pre-cleanup
    await Teacher.deleteMany({ email: 'john.doe.api.test@example.com' });
    await Classroom.deleteMany({ name: 'Test Lab 101' });
    await Course.deleteMany({ code: 'CS_TEST_101' });

    // Test 1: Create a Teacher
    console.log('\n[Test 1] Creating a new Teacher...');
    const newTeacher = await Teacher.create({
      name: 'John Doe API Test',
      email: 'john.doe.api.test@example.com',
      designation: 'Professor',
      department: 'Computer Science',
      status: 'active',
      availability: {} // Required
    });
    console.log('✅ Teacher created successfully:', newTeacher);
    testTeacherId = newTeacher._id || newTeacher.id;

    // Test 2: Create a Classroom
    console.log('\n[Test 2] Creating a new Classroom...');
    const newClassroom = await Classroom.create({
      name: 'Test Lab 101',
      building: 'Main', // Required
      floor: '1st', // Required
      type: 'Laboratory',
      capacity: 35,
      status: 'available',
      availability: {} // Required
    });
    console.log('✅ Classroom created successfully:', newClassroom);
    testClassroomId = newClassroom._id || newClassroom.id;

    // Test 3: Create a Course
    console.log('\n[Test 3] Creating a new Course...');
    const newCourse = await Course.create({
      code: 'CS_TEST_101',
      name: 'Intro to API Testing',
      department: 'Computer Science',
      program: 'BTech', // Required
      year: 1, // Required
      semester: 1, // Required
      credits: 3, // Required
      sessions: {}, // Required
      totalHoursPerWeek: 4, // Required
      enrolledStudents: 30, // Required
      isActive: true,
      assignedTeachers: [{ teacherId: testTeacherId }]
    });
    console.log('✅ Course created successfully:', newCourse);


    // Test 4: Find Operations
    console.log('\n[Test 4] Querying created entities...');
    const foundTeacher = await Teacher.findById(testTeacherId);
    console.log('✅ Found teacher via findById:', !!foundTeacher);
    
    // Cleanup 
    console.log('\n[Test 5] Cleaning up test data...');
    await Course.findByIdAndDelete(newCourse._id || newCourse.id);
    await Classroom.findByIdAndDelete(testClassroomId);
    await Teacher.findByIdAndDelete(testTeacherId);
    console.log('✅ Cleanup successful.');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    console.log('\n--- Tests Completed ---');
    process.exit(0);
  }
}

runTests();
