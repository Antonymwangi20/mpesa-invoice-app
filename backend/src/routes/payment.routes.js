import { Router } from 'express';
import { body, param } from 'express-validator';
import * as paymentController from '../controllers/payment.controller.js';
import { auth, checkOwnership, validate } from '../middleware/auth.middleware.js';

const router = Router();

// Public route for M-Pesa callback (no authentication required)
router.post('/callback', paymentController.mpesaCallback);

// Apply authentication middleware to all other routes
router.use(auth());

/**
 * @route   POST /api/payments/initiate
 * @desc    Initiate M-Pesa payment
 * @access  Private
 */
router.post(
  '/initiate',
  [
    body('invoiceId', 'Invoice ID is required').isUUID(),
    body('phoneNumber', 'Valid phone number is required').isMobilePhone(),
  ],
  validate,
  paymentController.initiatePayment
);

/**
 * @route   GET /api/payments/status/:checkoutRequestId
 * @desc    Check payment status
 * @access  Private
 */
router.get(
  '/status/:checkoutRequestId',
  [
    param('checkoutRequestId', 'Checkout request ID is required').notEmpty(),
  ],
  validate,
  paymentController.checkPaymentStatus
);

/**
 * @route   GET /api/payments/invoice/:invoiceId
 * @desc    Get payment history for an invoice
 * @access  Private
 */
router.get(
  '/invoice/:invoiceId',
  [
    param('invoiceId', 'Invoice ID is required').isUUID(),
  ],
  validate,
  checkOwnership('invoice'),
  paymentController.getPaymentHistory
);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment details by ID
 * @access  Private
 */
router.get(
  '/:id',
  [
    param('id', 'Payment ID is required').isUUID(),
  ],
  validate,
  paymentController.getPaymentDetails
);

export default router;
