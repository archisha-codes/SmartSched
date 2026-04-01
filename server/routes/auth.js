const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'faculty', 'student'])
    .withMessage('Role must be admin, faculty, or student'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department name cannot exceed 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, department } = req.body;

    if (role && role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin accounts can be created through registration. Teachers and students receive credentials from admin.'
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'admin',
        department
      }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('User registered successfully', { userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const isDemoLogin = email === 'admin@demo.com' || email === 'teacher@demo.com' || email === 'student@demo.com';
    
    if (isDemoLogin) {
      let demoValid = false;
      let demoRole = '';
      let demoName = '';
      
      if (email === 'admin@demo.com' && password === 'admin123') {
        demoValid = true; demoRole = 'admin'; demoName = 'Admin User';
      } else if (email === 'teacher@demo.com' && password === 'teacher123') {
        demoValid = true; demoRole = 'faculty'; demoName = 'Teacher User';
      } else if (email === 'student@demo.com' && password === 'student123') {
        demoValid = true; demoRole = 'student'; demoName = 'Student User';
      }
      
      if (demoValid) {
        const token = jwt.sign(
          { userId: 'demo-' + demoRole, email, role: demoRole },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        logger.info('Demo user logged in successfully', { email, role: demoRole });
        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: { id: 'demo-' + demoRole, name: demoName, email: email, role: demoRole, department: 'Demo Department' },
          isDemo: true
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        isFirstLogin: user.isFirstLogin ? false : undefined
      }
    });

    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('User logged in successfully', { userId: updatedUser.id, email: updatedUser.email, lastLogin: updatedUser.lastLogin });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        preferences: updatedUser.preferences,
        mustChangePassword: updatedUser.mustChangePassword,
        isFirstLogin: updatedUser.isFirstLogin
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    logger.info('User logged out', { userId: req.user.userId });
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during logout' });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching profile' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('department').optional().trim().isLength({ max: 100 }),
  body('preferences.theme').optional().isIn(['light', 'dark']),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const updates = req.body;
    let user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let updatedPreferences = user.preferences;
    if (updates.preferences) {
      updatedPreferences = { ...user.preferences, ...updates.preferences };
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: updates.name !== undefined ? updates.name : undefined,
        department: updates.department !== undefined ? updates.department : undefined,
        preferences: updatedPreferences
      }
    });

    logger.info('User profile updated', { userId: user.id });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        preferences: user.preferences
      }
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating profile' });
  }
});

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Password confirmation does not match');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isFirstLogin: false,
        mustChangePassword: false,
        passwordChangedAt: new Date()
      }
    });

    const emailSent = await emailService.sendPasswordChangeConfirmation({ name: user.name, email: user.email, role: user.role });
    logger.info('User password changed', { userId: user.id, emailSent });

    res.json({ success: true, message: 'Password changed successfully', emailSent });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while changing password' });
  }
});

/**
 * @route   PUT /api/auth/first-time-password-change
 * @desc    Change password for first-time users
 * @access  Private
 */
router.put('/first-time-password-change', authenticateToken, [
  body('newPassword').isLength({ min: 6 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Password confirmation does not match');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.mustChangePassword && !user.isFirstLogin) {
      return res.status(403).json({ success: false, message: 'This endpoint is only for first-time password changes' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isFirstLogin: false,
        mustChangePassword: false,
        passwordChangedAt: new Date()
      }
    });

    const emailSent = await emailService.sendPasswordChangeConfirmation({ name: user.name, email: user.email, role: user.role });
    logger.info('First-time password changed', { userId: user.id, emailSent });

    res.json({ success: true, message: 'Password set successfully. You can now use all features of the system.', emailSent });
  } catch (error) {
    logger.error('First-time password change error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while changing password' });
  }
});

/**
 * @route   GET /api/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Private
 */
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: { id: req.user.userId, email: req.user.email, role: req.user.role }
  });
});

/**
 * Middleware to authenticate JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

/**
 * @route   POST /api/auth/create-user
 * @desc    Admin creates teacher or student account
 * @access  Private (Admin only)
 */
router.post('/create-user', [
  authenticateToken,
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['faculty', 'student']),
  body('department').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can create user accounts' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role, department } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        department
      }
    });

    logger.info('User created by admin', { userId: user.id, email: user.email, role: user.role, createdBy: req.user.userId });

    res.status(201).json({
      success: true,
      message: `${role === 'faculty' ? 'Teacher' : 'Student'} account created successfully`,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
      loginCredentials: { email: user.email, password }
    });
  } catch (error) {
    logger.error('User creation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating user account' });
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin only)
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can view user accounts' });
    }

    const { role, department, page = 1, limit = 50 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    let where = {};
    if (role && ['admin', 'faculty', 'student'].includes(role)) where.role = role;
    if (department) where.department = { contains: department, mode: 'insensitive' };

    const users = await prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        isFirstLogin: true,
        mustChangePassword: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        preferences: true
      }
    });

    const total = await prisma.user.count({ where });

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching users' });
  }
});

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete user account (Admin only)
 * @access  Private (Admin only)
 */
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete user accounts' });
    }

    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await prisma.user.delete({ where: { id: req.params.id } });

    logger.info('User deleted by admin', { deletedUserId: req.params.id, deletedBy: req.user.userId });
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Internal server error while deleting user' });
  }
});

router.authenticateToken = authenticateToken;

module.exports = router;
