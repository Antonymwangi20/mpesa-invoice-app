import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';
import { hashPassword, comparePassword } from '../config/auth.js';

// Define the User model with fields required by simple-authx
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  // simple-authx requires a username field
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true, // Optional if using email as username
  },
  // Simple-authx required fields
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
  },
  // Custom fields
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'business_name',
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login',
  },
  roles: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['user'],
  },
  // For password reset and email verification
  resetPasswordToken: {
    type: DataTypes.STRING,
    field: 'reset_password_token',
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    field: 'reset_password_expires',
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    field: 'email_verification_token',
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    field: 'email_verification_expires',
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  // simple-authx compatible hooks
  hooks: {
    beforeCreate: async (user) => {
      // Set username to email if not provided
      if (!user.username) {
        user.username = user.email;
      }
      
      // Hash password if it's being set
      if (user.password) {
        user.password = await hashPassword(user.password);
      }
    },
    beforeUpdate: async (user) => {
      // Update password hash if password was changed
      if (user.changed('password')) {
        user.password = await hashPassword(user.password);
      }
    },
  },
});

// Add instance methods required by simple-authx
User.prototype.verifyPassword = async function(password) {
  return await comparePassword(password, this.password);
};

// Add method to get user by credentials (used by simple-authx)
User.findByCredentials = async function(identifier, password) {
  // Find user by email or username
  const user = await this.findOne({
    where: {
      [Op.or]: [
        { email: identifier },
        { username: identifier }
      ]
    }
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isMatch = await user.verifyPassword(password);
  return isMatch ? user : null;
};

// Add method to get user by ID (used by simple-authx)
User.findById = async function(id) {
  return this.findByPk(id);
};

// Add method to update last login
User.prototype.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// Add method to check if user has a specific role
User.prototype.hasRole = function(role) {
  return this.roles && this.roles.includes(role);
};

// Add method to check if user has any of the specified roles
User.prototype.hasAnyRole = function(roles) {
  if (!this.roles) return false;
  return roles.some(role => this.roles.includes(role));
};

export default User;
