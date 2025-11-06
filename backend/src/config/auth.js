import { createAuth } from 'simple-authx';
import dotenv from 'dotenv';
import { SequelizeAdapter } from 'simple-authx/adapters';
import sequelize from './db.js';

dotenv.config();

// Initialize the auth system with production-ready settings
const auth = createAuth({
  // Use JWT for stateless authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    refreshTokenExpiresIn: '90d',
  },
  
  // Use Sequelize adapter for database operations
  adapter: new SequelizeAdapter({
    sequelize,
    modelName: 'User',
  }),
  
  // Security settings
  security: {
    password: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
    rateLimit: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
  },
  
  // Session management
  session: {
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  },
  
  // Enable email verification (optional)
  emailVerification: {
    enabled: process.env.NODE_ENV === 'production',
    from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
  },
  
  // Enable password reset (optional)
  passwordReset: {
    enabled: true,
    resetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password',
  },
});

export default auth;

// Export commonly used auth methods
export const {
  authenticate,
  authorize,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  refreshToken,
  requireAuth,
  requireRole,
  requireAnyRole,
  requireAllRoles,
} = auth;
