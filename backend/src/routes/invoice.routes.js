import { Router } from 'express';
import { body, query } from 'express-validator';
import * as invoiceController from '../controllers/invoice.controller.js';
import { auth, checkOwnership, validate } from '../middleware/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(auth());

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices for the authenticated user
 * @access  Private
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  invoiceController.getInvoices
);

/**
 * @route   GET /api/invoices/public/:publicId
 * @desc    Get a public invoice by public ID (no authentication required)
 * @access  Public
 */
router.get(
  '/public/:publicId',
  invoiceController.getPublicInvoice
);

/**
 * @route   POST /api/invoices
 * @desc    Create a new invoice
 * @access  Private
 */
router.post(
  '/',
  [
    body('customerName', 'Customer name is required').notEmpty(),
    body('customerPhone', 'Valid customer phone number is required').isMobilePhone(),
    body('customerEmail', 'Please include a valid email').optional().isEmail(),
    body('amount', 'Amount must be a positive number').isFloat({ min: 1 }),
    body('description', 'Description is required').notEmpty(),
    body('dueDate', 'Please include a valid due date').optional().isISO8601(),
  ],
  validate,
  invoiceController.createInvoice
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private
 */
router.get(
  '/:id',
  checkOwnership('invoice'),
  invoiceController.getInvoice
);

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update an invoice
 * @access  Private
 */
router.put(
  '/:id',
  [
    body('customerName', 'Customer name is required').optional().notEmpty(),
    body('customerPhone', 'Valid customer phone number is required').optional().isMobilePhone(),
    body('customerEmail', 'Please include a valid email').optional().isEmail(),
    body('amount', 'Amount must be a positive number').optional().isFloat({ min: 1 }),
    body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    body('dueDate', 'Please include a valid due date').optional().isISO8601(),
  ],
  validate,
  checkOwnership('invoice'),
  invoiceController.updateInvoice
);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete an invoice
 * @access  Private
 */
router.delete(
  '/:id',
  checkOwnership('invoice'),
  invoiceController.deleteInvoice
);

/**
 * @route   POST /api/invoices/:id/send
 * @desc    Send invoice to customer
 * @access  Private
 */
router.post(
  '/:id/send',
  [
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
  ],
  validate,
  checkOwnership('invoice'),
  invoiceController.sendInvoice
);

export default router;
