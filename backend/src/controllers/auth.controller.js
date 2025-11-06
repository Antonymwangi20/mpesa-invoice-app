import { Op } from 'sequelize';
import { User } from '../models/index.js';
import auth, { requireAuth, requireRole } from '../config/auth.js';
import { 
  BadRequestError, 
  UnauthorizedError, 
  ConflictError, 
  NotFoundError 
} from '../middleware/errorHandler.js';

/**
 * Register a new user
 * Uses simple-authx's built-in registration
 */
export const register = async (req, res, next) => {
  try {
    const { email, phone, password, businessName } = req.body;

    // Use simple-authx's registration
    const { user, token } = await auth.register({
      email,
      username: email, // Using email as username
      password,
      // Custom fields
      phone,
      businessName,
      roles: ['user'], // Default role
    });

    // Remove sensitive data from response
    const userData = user.get({ plain: true });
    delete userData.password;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL') {
      return next(new ConflictError('Email already in use'));
    }
    next(error);
  }
};

/**
 * Login user
 * Uses simple-authx's built-in login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Use simple-authx's login
    const { user, token } = await auth.login(email, password);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await user.updateLastLogin();

    // Remove sensitive data from response
    const userData = user.get({ plain: true });
    delete userData.password;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    next(new UnauthorizedError('Invalid credentials'));
  }
};

/**
 * Get current user profile
 * Uses simple-authx's requireAuth middleware
 */
export const getProfile = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { 
          exclude: [
            'password', 
            'resetPasswordToken', 
            'resetPasswordExpires',
            'emailVerificationToken',
            'emailVerificationExpires'
          ] 
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
];

/**
 * Update user profile
 * Uses simple-authx's requireAuth middleware
 */
export const updateProfile = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const { businessName, phone } = req.body;
      const user = req.user;

      // Update user data
      const updatedUser = await user.update({
        businessName: businessName || user.businessName,
        phone: phone || user.phone,
      });

      // Remove sensitive data from response
      const userData = updatedUser.get({ plain: true });
      delete userData.password;
      delete userData.resetPasswordToken;
      delete userData.resetPasswordExpires;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: userData,
      });
    } catch (error) {
      next(error);
    }
  }
];

/**
 * Change password
 * Uses simple-authx's requireAuth middleware
 */
export const changePassword = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user;

      // Use simple-authx's password change
      await auth.changePassword(user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password updated successfully',
      });
    } catch (error) {
      if (error.message === 'INVALID_PASSWORD') {
        return next(new BadRequestError('Current password is incorrect'));
      }
      next(error);
    }
  }
];

/**
 * Request password reset
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Use simple-authx's forgot password
    await auth.forgotPassword(email);
    
    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    // Don't reveal if user exists or not
    if (error.message === 'USER_NOT_FOUND') {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }
    next(error);
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    // Use simple-authx's reset password
    await auth.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    if (error.message === 'INVALID_TOKEN') {
      return next(new BadRequestError('Invalid or expired token'));
    }
    next(error);
  }
};

/**
 * Verify email with token
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Use simple-authx's email verification
    await auth.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    if (error.message === 'INVALID_TOKEN') {
      return next(new BadRequestError('Invalid or expired verification token'));
    }
    next(error);
  }
};
