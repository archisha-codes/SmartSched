import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import AdminSidebar from '../components/AdminSidebar';
import { 
  Calendar, 
  BookOpen, 
  ArrowLeft,
  ArrowRight,
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  School,
  Clock,
  Layers
} from 'lucide-react';
import { 
  getPrograms, 
  createProgram, 
  updateProgram, 
  deleteProgram,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadCSV
} from '../services/api';

const ProgramsData = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('programs');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [formType, setFormType] = useState('program'); // 'program', 'course', 'batch'
  
  // Get sessionId from localStorage
  const [sessionId, setSessionId] = useState(localStorage.getItem('currentTimetableSessionId') || '');
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const renderImportModal = () => {
    if (!showImportModal) return null;
    const isPrograms = showImportModal === 'programs';

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <Upload className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Import {isPrograms ? 'Programs' : 'Courses'}
            </h2>
            <button 
              onClick={() => setShowImportModal(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Step 1: Download Template</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                First, download the sample CSV file to ensure your data follows the correct format.
              </p>
              <button 
                onClick={() => {
                  if (isPrograms) {
                    const headers = ['id', 'name', 'department', 'degree', 'duration', 'totalSemesters', 'currentSemester', 'totalStudents', 'divisions', 'studentsPerDivision', 'labBatches', 'studentsPerBatch'];
                    const rows = [
                      ['P001', 'Computer Science & Engineering', 'Computer Science', 'B.Tech', '4 years', '8', '1', '240', '4', '60', '3', '20'],
                      ['P002', 'Information Technology', 'Computer Science', 'B.Tech', '4 years', '8', '1', '120', '2', '60', '3', '20']
                    ];
                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute('download', 'program_import_sample.csv');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } else {
                    const headers = ['id', 'name', 'code', 'programId', 'semester', 'credits', 'type', 'hoursPerWeek', 'requiresLab', 'labHours', 'teacher'];
                    const rows = [
                      ['C001', 'Data Structures', 'CS301', 'P001', '3', '4', 'Theory', '3', 'true', '2', 'Dr. John Doe'],
                      ['C002', 'Database Systems', 'CS302', 'P001', '3', '3', 'Theory', '3', 'false', '0', 'Jane Smith']
                    ];
                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute('download', 'course_import_sample.csv');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="w-full flex justify-center items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition border border-blue-200 dark:border-blue-800"
                type="button"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample CSV</span>
              </button>
            </div>
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Step 2: Upload Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Upload your completed CSV file here.
              </p>
              <label className="w-full flex flex-col items-center justify-center px-4 py-8 bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Click to browse file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    handleCSVImport(e, showImportModal);
                    setShowImportModal(null);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Form states for programs and courses
  const [programForm, setProgramForm] = useState({
    id: '',
    name: '',
    department: '',
    degree: '',
    duration: '',
    totalSemesters: '',
    currentSemester: '',
    totalStudents: '',
    divisions: '',
    studentsPerDivision: '',
    labBatches: '',
    studentsPerBatch: '',
    status: 'active'
  });

  const [courseForm, setCourseForm] = useState({
    id: '',
    name: '',
    code: '',
    programId: '',
    semester: '',
    credits: '',
    type: '',
    hoursPerWeek: '',
    requiresLab: false,
    labHours: '',
    teacher: '',
    prerequisites: [],
    status: 'active'
  });

  // Update sessionId when it changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newSessionId = localStorage.getItem('currentTimetableSessionId') || '';
      setSessionId(newSessionId);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load programs and courses data on component mount
  useEffect(() => {
    loadPrograms();
    loadCourses();
  }, []);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const response = await getPrograms({ sessionId });
      setPrograms(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading programs:', err);
      setError('Failed to load programs data');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await getCourses({ sessionId });
      setCourses(response.data || []);
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  const departments = ['Engineering', 'Arts & Sciences', 'Business', 'Medical Sciences', 'Law'];
  const degrees = ['B.Tech', 'B.Sc', 'B.A', 'B.Com', 'BBA', 'MBA', 'M.Tech', 'M.Sc', 'Ph.D'];
  const courseTypes = ['Theory', 'Lab', 'Theory + Lab', 'Project', 'Seminar'];
  const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const handleBack = () => {
    navigate('/classrooms-data');
  };

  const handleAddProgram = () => {
    setFormType('program');
    setShowAddForm(true);
    setEditingItem(null);
    setProgramForm({
      id: `P${String(programs.length + 1).padStart(3, '0')}`,
      name: '',
      department: '',
      degree: '',
      duration: '',
      totalSemesters: '',
      currentSemester: '',
      totalStudents: '',
      divisions: '',
      studentsPerDivision: '',
      labBatches: '',
      studentsPerBatch: '',
      status: 'active'
    });
  };

  const handleAddCourse = () => {
    setFormType('course');
    setShowAddForm(true);
    setEditingItem(null);
    setCourseForm({
      id: `C${String(courses.length + 1).padStart(3, '0')}`,
      name: '',
      code: '',
      programId: '',
      semester: '',
      credits: '',
      type: '',
      hoursPerWeek: '',
      requiresLab: false,
      labHours: '',
      teacher: '',
      prerequisites: [],
      status: 'active'
    });
  };

  const handleEditProgram = (program) => {
    setFormType('program');
    setEditingItem(program.id);
    setProgramForm(program);
    setShowAddForm(true);
  };

  const handleEditCourse = (course) => {
    setFormType('course');
    setEditingItem(course.id);
    setCourseForm(course);
    setShowAddForm(true);
  };

  const handleDeleteProgram = async (programId) => {
    if (!window.confirm('Are you sure you want to delete this program?')) return;
    try {
      await deleteProgram(programId, { sessionId });
      await loadPrograms();
    } catch (err) {
      console.error('Error deleting program:', err);
      setError('Failed to delete program');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await deleteCourse(courseId, { sessionId });
      await loadCourses();
    } catch (err) {
      console.error('Error deleting course:', err);
      setError('Failed to delete course');
    }
  };

  const handleCSVImport = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const response = await uploadCSV(file, type);
      if (response.success || response.imported !== undefined) {
        alert(`Successfully imported ${response.imported || 0} items. ${response.errors || 0} errors.`);
        if (type === 'programs') loadPrograms();
        else loadCourses();
      } else {
        alert('Failed to import CSV: ' + (response.message || 'Unknown error.'));
      }
    } catch (error) {
      console.error('CSV import error:', error);
      alert('Error importing CSV file: ' + error.message);
    }
    event.target.value = '';
  };

  const handleSaveProgram = async () => {
    try {
      if (editingItem) {
        await updateProgram(editingItem, programForm, { sessionId });
      } else {
        await createProgram(programForm, { sessionId });
      }
      await loadPrograms();
      setShowAddForm(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Error saving program:', err);
      setError('Failed to save program');
    }
  };

  const handleSaveCourse = async () => {
    try {
      if (editingItem) {
        await updateCourse(editingItem, courseForm, { sessionId });
      } else {
        await createCourse(courseForm, { sessionId });
      }
      await loadCourses();
      setShowAddForm(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Error saving course:', err);
      setError('Failed to save course');
    }
  };

  const renderProgramForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingItem ? 'Edit Program' : 'Add New Program'}
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Program ID</label>
              <input
                type="text"
                value={programForm.id}
                onChange={(e) => setProgramForm({...programForm, id: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="P001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Program Name</label>
              <input
                type="text"
                value={programForm.name}
                onChange={(e) => setProgramForm({...programForm, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Computer Science & Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
              <select
                value={programForm.department}
                onChange={(e) => setProgramForm({...programForm, department: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Degree</label>
              <select
                value={programForm.degree}
                onChange={(e) => setProgramForm({...programForm, degree: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Degree</option>
                {degrees.map(degree => (
                  <option key={degree} value={degree}>{degree}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</label>
              <input
                type="text"
                value={programForm.duration}
                onChange={(e) => setProgramForm({...programForm, duration: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="4 years"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Semesters</label>
              <input
                type="number"
                value={programForm.totalSemesters}
                onChange={(e) => setProgramForm({...programForm, totalSemesters: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="8"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Semester</label>
              <select
                value={programForm.currentSemester}
                onChange={(e) => setProgramForm({...programForm, currentSemester: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Current Semester</option>
                {semesters.map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Students</label>
              <input
                type="number"
                value={programForm.totalStudents}
                onChange={(e) => setProgramForm({...programForm, totalStudents: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="240"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Number of Divisions</label>
              <input
                type="number"
                value={programForm.divisions}
                onChange={(e) => setProgramForm({...programForm, divisions: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Students per Division</label>
              <input
                type="number"
                value={programForm.studentsPerDivision}
                onChange={(e) => setProgramForm({...programForm, studentsPerDivision: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lab Batches per Division</label>
              <input
                type="number"
                value={programForm.labBatches}
                onChange={(e) => setProgramForm({...programForm, labBatches: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Students per Lab Batch</label>
              <input
                type="number"
                value={programForm.studentsPerBatch}
                onChange={(e) => setProgramForm({...programForm, studentsPerBatch: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="20"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
          <button
            onClick={() => setShowAddForm(false)}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProgram}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{editingItem ? 'Update' : 'Save'} Program</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderCourseForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingItem ? 'Edit Course' : 'Add New Course'}
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course ID</label>
              <input
                type="text"
                value={courseForm.id}
                onChange={(e) => setCourseForm({...courseForm, id: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="C001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course Name</label>
              <input
                type="text"
                value={courseForm.name}
                onChange={(e) => setCourseForm({...courseForm, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Data Structures and Algorithms"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course Code</label>
              <input
                type="text"
                value={courseForm.code}
                onChange={(e) => setCourseForm({...courseForm, code: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="CS301"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Program</label>
              <select
                value={courseForm.programId}
                onChange={(e) => setCourseForm({...courseForm, programId: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Program</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Semester</label>
              <select
                value={courseForm.semester}
                onChange={(e) => setCourseForm({...courseForm, semester: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Semester</option>
                {semesters.map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Credits</label>
              <input
                type="number"
                value={courseForm.credits}
                onChange={(e) => setCourseForm({...courseForm, credits: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course Type</label>
              <select
                value={courseForm.type}
                onChange={(e) => setCourseForm({...courseForm, type: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Type</option>
                {courseTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hours per Week</label>
              <input
                type="number"
                value={courseForm.hoursPerWeek}
                onChange={(e) => setCourseForm({...courseForm, hoursPerWeek: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="6"
              />
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={courseForm.requiresLab}
                  onChange={(e) => setCourseForm({...courseForm, requiresLab: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Requires Lab</span>
              </label>
              {courseForm.requiresLab && (
                <input
                  type="number"
                  value={courseForm.labHours}
                  onChange={(e) => setCourseForm({...courseForm, labHours: e.target.value})}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Lab hours"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assigned Teacher</label>
              <input
                type="text"
                value={courseForm.teacher}
                onChange={(e) => setCourseForm({...courseForm, teacher: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Dr. Sarah Johnson"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
          <button
            onClick={() => setShowAddForm(false)}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveCourse}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{editingItem ? 'Update' : 'Save'} Course</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderProgramsList = () => (
    <div className="space-y-6">

      {/* Programs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Academic Programs</h3>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowImportModal('programs')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button 
                onClick={handleAddProgram}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Program</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Structure</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Sem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {programs.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{program.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{program.id} • {program.degree}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{program.department}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{program.duration}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{program.totalStudents} students</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{program.divisions} divisions</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{program.studentsPerDivision}/div</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{program.studentsPerBatch}/batch</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">Sem {program.currentSemester}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">of {program.totalSemesters}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {program.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleEditProgram(program)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProgram(program.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCoursesList = () => (
    <div className="space-y-6">

      {/* Courses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Courses</h3>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowImportModal('courses')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button 
                onClick={handleAddCourse}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Course</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Course Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program & Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credits & Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lab</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{course.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{course.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {programs.find(p => p.id === course.programId)?.degree || programs.find(p => p.id === course.programId)?.name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Semester {course.semester}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{course.credits} Credits</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{course.hoursPerWeek}h/week</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{course.type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {course.requiresLab ? `${course.labHours}h lab` : 'No Lab'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleEditCourse(course)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCourse(course.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDivisionsBatchesList = () => (
    <div className="space-y-6">
      {/* Divisions & Batches Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Divisions & Batches</h3>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowImportModal('programs')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Division</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lab Batches</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students/Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {programs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Divisions Found</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">Add programs first to configure divisions and batches.</p>
                      <button 
                        onClick={() => setActiveTab('programs')}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Go to Programs
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                programs.flatMap((program) => {
                  const divCount = parseInt(program.divisions || 0);
                  if (divCount === 0) {
                    return [(
                      <tr key={program.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{program.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{program.degree}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">No divisions configured</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{program.totalStudents || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{program.labBatches || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{program.studentsPerBatch || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Sem {program.currentSemester || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {program.status}
                          </span>
                        </td>
                      </tr>
                    )];
                  }
                  return Array.from({ length: divCount }, (_, i) => (
                    <tr key={`${program.id}-div-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {i === 0 ? (
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{program.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{program.degree}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 dark:text-gray-500 pl-14">↳</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                          Division {String.fromCharCode(65 + i)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{program.studentsPerDivision || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{program.labBatches || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{program.studentsPerBatch || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Sem {program.currentSemester || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {program.status}
                        </span>
                      </td>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'programs': return renderProgramsList();
      case 'courses': return renderCoursesList();
      case 'divisions': return renderDivisionsBatchesList();
      default: return renderProgramsList();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Programs, Courses & Batches</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-500 dark:text-gray-400">Welcome, {user?.name}</span>
              <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="w-full flex pt-0">
        {/* Left Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ maxHeight: 'calc(100vh - 4rem)', overflow: 'auto' }}>
            {/* Page Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Academic Programs & Courses</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Configure academic programs, courses, and student divisions for comprehensive timetable planning
              </p>
            </div>

            {/* Unified Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Programs</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{programs.length}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Courses</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{courses.length}</p>
                  </div>
                  <GraduationCap className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Schools</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {[...new Set(programs.map(p => p.department))].length}
                    </p>
                  </div>
                  <School className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Lab Courses</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {courses.filter(c => c.requiresLab).length}
                    </p>
                  </div>
                  <Layers className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            {/* Tabs inside content area */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('programs')}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'programs'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Academic Programs
                </button>
                <button
                  onClick={() => setActiveTab('courses')}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'courses'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Courses
                </button>
                <button
                  onClick={() => setActiveTab('divisions')}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'divisions'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Divisions & Batches
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {renderActiveTabContent()}

            <div className="mt-8 flex justify-between">
              <button 
                onClick={handleBack}
                className="flex items-center px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <button 
                onClick={() => navigate('/infrastructure-data')}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Next: Infrastructure & Policy
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (formType === 'program' ? renderProgramForm() : renderCourseForm())}
      {/* Import Modal */}
      {showImportModal && renderImportModal()}
    </div>
  );
};

export default ProgramsData;
