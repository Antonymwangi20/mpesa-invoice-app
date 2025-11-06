import { authenticate, authorize } from '../config/auth.js';
import { validationResult } from 'express-validator';

/**
 * Middleware to authenticate JWT token
 */
export const auth = (roles = []) => {
  return [
    // Authenticate JWT token
    (req, res, next) => {
      authenticate(req, res, (err) => {
        if (err) {
          return res.status(401).json({
            success: false,
            message: 'Authentication failed',
            error: err.message,
          });
        }
        next();
      });
    },
    
    // Check if user has required role
    (req, res, next) => {
      if (roles.length && !authorize(req.user, roles)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Insufficient permissions',
        });
      }
      next();
    },
  ];
};

/**
 * Middleware to check if user is the owner of the resource
 * @param {string} model - The model name (lowercase)
 * @param {string} paramName - The parameter name in the route (default: 'id')
 * @returns {Function} Express middleware function
 */
export const checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = req.app.get('models')[model];
      const record = await Model.findOne({
        where: { id: req.params[paramName] },
      });

      if (!record) {
        return res.status(404).json({
          success: false,
          message: `${model} not found`,
        });
      }

      // Check if the user is the owner of the resource
      if (record.user_id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource',
        });
      }

      // Attach the record to the request object for use in the controller
      req[model] = record;
      next();
    } catch (error) {
      console.error(`Error in checkOwnership for ${model}:`, error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to validate request data
 * @param {Array} validations - Array of validation rules
 * @returns {Function} Express middleware function
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  };
};
