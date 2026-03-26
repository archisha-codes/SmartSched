import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import AdminSidebar from '../components/AdminSidebar';
import { 
  BookOpen,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Clock,
  Calendar,
  School,
  FileText,
  Settings
} from 'lucide-react';

const InfrastructureData = () => {
  const { user, logout } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  
  // Session ID from localStorage for timetable session context
  const [sessionId, setSessionId] = useState(localStorage.getItem('currentTimetableSessionId') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('holidays');

  // Listen for session ID changes
  useEffect(() => {
    const handleStorageChange = () => {
      const newSessionId = localStorage.getItem('currentTimetableSessionId') || '';
      setSessionId(newSessionId);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sessionIdChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionIdChanged', handleStorageChange);
    };
  }, []);

  // Holiday state
  const [holidays, setHolidays] = useState([]);

  // Time slots state
  const [timeSlots, setTimeSlots] = useState([]);

  // Policy state
  const [policies, setPolicies] = useState({
    maxClassesPerDay: 6,
    maxConsecutiveClasses: 3,
    breakDuration: 60,
    lunchBreakStart: '13:00',
    lunchBreakEnd: '14:00',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Load holidays from API
  const loadHolidays = async () => {
    if (!sessionId) return;
    try {
      const queryParams = new URLSearchParams({ sessionId });
      const response = await fetch(`http://localhost:8000/api/data/holidays?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setHolidays(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading holidays:', err);
    }
  };

  // Load time slots from API
  const loadTimeSlots = async () => {
    if (!sessionId) return;
    try {
      const queryParams = new URLSearchParams({ sessionId });
      const response = await fetch(`http://localhost:8000/api/data/time-slots?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTimeSlots(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading time slots:', err);
    }
  };

  // Load data when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadHolidays();
      loadTimeSlots();
    }
  }, [sessionId]);

  // Holiday CRUD handlers
  const handleAddHoliday = async (holidayData) => {
    try {
      const response = await fetch('http://localhost:8000/api/data/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...holidayData, sessionId })
      });
      if (response.ok) {
        await loadHolidays();
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Error adding holiday:', err);
      setError('Failed to add holiday');
    }
  };

  const handleUpdateHoliday = async (holidayId, holidayData) => {
    try {
      const response = await fetch(`http://localhost:8000/api/data/holidays/${holidayId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...holidayData, sessionId })
      });
      if (response.ok) {
        await loadHolidays();
        setEditingItem(null);
      }
    } catch (err) {
      console.error('Error updating holiday:', err);
      setError('Failed to update holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const response = await fetch(`http://localhost:8000/api/data/holidays/${holidayId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ sessionId })
      });
      if (response.ok) {
        await loadHolidays();
      }
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setError('Failed to delete holiday');
    }
  };

  // Time slot CRUD handlers
  const handleAddTimeSlot = async (slotData) => {
    try {
      const response = await fetch('http://localhost:8000/api/data/time-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...slotData, sessionId })
      });
      if (response.ok) {
        await loadTimeSlots();
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Error adding time slot:', err);
      setError('Failed to add time slot');
    }
  };

  const handleUpdateTimeSlot = async (slotId, slotData) => {
    try {
      const response = await fetch(`http://localhost:8000/api/data/time-slots/${slotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...slotData, sessionId })
      });
      if (response.ok) {
        await loadTimeSlots();
        setEditingItem(null);
      }
    } catch (err) {
      console.error('Error updating time slot:', err);
      setError('Failed to update time slot');
    }
  };

  const handleDeleteTimeSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this time slot?')) return;
    try {
      const response = await fetch(`http://localhost:8000/api/data/time-slots/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ sessionId })
      });
      if (response.ok) {
        await loadTimeSlots();
      }
    } catch (err) {
      console.error('Error deleting time slot:', err);
      setError('Failed to delete time slot');
    }
  };

  // Policy save handler
  const handleSavePolicies = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/data/system-config', {
        method: sessionId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ ...policies, sessionId })
      });
      if (response.ok) {
        alert('Policies saved successfully!');
      }
    } catch (err) {
      console.error('Error saving policies:', err);
      setError('Failed to save policies');
    }
  };

  const handleBack = () => {
    navigate('/programs-data');
  };

  const handleFinish = () => {
    navigate('/admin-dashboard');
  };

  const renderHolidays = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Academic Holidays</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Holiday</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Holiday Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {holidays.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No holidays found. {!sessionId && 'Please select a timetable session first.'}
                </td>
              </tr>
            ) : (
              holidays.map((holiday) => (
                <tr key={holiday._id || holiday.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{holiday.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{holiday.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{holiday.type}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setEditingItem(holiday)} 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteHoliday(holiday._id || holiday.id)} 
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTimeSlots = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Time Slots</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Time Slot</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Slot Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Start Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">End Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {timeSlots.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No time slots found. {!sessionId && 'Please select a timetable session first.'}
                </td>
              </tr>
            ) : (
              timeSlots.map((slot) => (
                <tr key={slot._id || slot.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{slot.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{slot.startTime}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{slot.endTime}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setEditingItem(slot)} 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTimeSlot(slot._id || slot.id)} 
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Timetable Policies</h3>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Classes Per Day
            </label>
            <input
              type="number"
              value={policies.maxClassesPerDay}
              onChange={(e) => setPolicies({...policies, maxClassesPerDay: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Consecutive Classes
            </label>
            <input
              type="number"
              value={policies.maxConsecutiveClasses}
              onChange={(e) => setPolicies({...policies, maxConsecutiveClasses: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Break Duration (minutes)
            </label>
            <input
              type="number"
              value={policies.breakDuration}
              onChange={(e) => setPolicies({...policies, breakDuration: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lunch Break Start
            </label>
            <input
              type="time"
              value={policies.lunchBreakStart}
              onChange={(e) => setPolicies({...policies, lunchBreakStart: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lunch Break End
            </label>
            <input
              type="time"
              value={policies.lunchBreakEnd}
              onChange={(e) => setPolicies({...policies, lunchBreakEnd: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Working Days
          </label>
          <div className="flex flex-wrap gap-3">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <label key={day} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={policies.workingDays.includes(day)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPolicies({...policies, workingDays: [...policies.workingDays, day]});
                    } else {
                      setPolicies({...policies, workingDays: policies.workingDays.filter(d => d !== day)});
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{day}</span>
              </label>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSavePolicies}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Policies</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Infrastructure & Policy</h1>
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
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Infrastructure & Policy Management
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Configure holidays, time slots, and timetable generation policies
                  </p>
                </div>
                <button 
                  onClick={handleBack}
                  className="flex items-center px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Programs
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('holidays')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'holidays'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                  >
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Holidays
                  </button>
                  <button
                    onClick={() => setActiveTab('timeSlots')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'timeSlots'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline mr-2" />
                    Time Slots
                  </button>
                  <button
                    onClick={() => setActiveTab('policies')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'policies'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                  >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Policies
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'holidays' && renderHolidays()}
            {activeTab === 'timeSlots' && renderTimeSlots()}
            {activeTab === 'policies' && renderPolicies()}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button 
                onClick={handleBack}
                className="flex items-center px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back: Programs Data
              </button>
              
              <button 
                onClick={handleFinish}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Finish Setup
                <Settings className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InfrastructureData;
