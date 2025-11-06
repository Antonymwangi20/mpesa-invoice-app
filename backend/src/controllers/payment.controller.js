import { Invoice, Payment } from '../models/index.js';
import mpesaService from '../services/mpesa.service.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * Initiate M-Pesa payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const initiatePayment = async (req, res, next) => {
  try {
    const { invoiceId, phoneNumber } = req.body;
    const userId = req.user.id;

    // Find the invoice
    const invoice = await Invoice.findOne({
      where: { id: invoiceId, user_id: userId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      throw new BadRequestError('This invoice has already been paid');
    }

    // Format phone number (ensure it starts with 254)
    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = `254${formattedPhone.substring(1)}`;
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = `254${formattedPhone}`;
    }

    // Create payment record
    const payment = await Payment.create({
      amount: invoice.amount,
      phone_number: formattedPhone,
      status: 'pending',
      invoice_id: invoice.id,
      user_id: userId,
    });

    // Generate a unique account reference
    const accountReference = `INV-${invoice.id.substring(0, 8).toUpperCase()}`;
    const description = `Payment for invoice #${invoice.invoice_number}`;

    // Initiate STK push
    const response = await mpesaService.initiateSTKPush(
      formattedPhone,
      invoice.amount,
      accountReference,
      description
    );

    if (!response.success) {
      // Update payment status to failed
      await payment.update({
        status: 'failed',
        result_code: response.error?.response?.data?.errorCode || 'UNKNOWN_ERROR',
        result_desc: response.error?.response?.data?.errorMessage || 'Failed to initiate payment',
      });

      throw new BadRequestError('Failed to initiate payment', response.error);
    }

    // Update payment with M-Pesa details
    await payment.update({
      checkout_request_id: response.data.CheckoutRequestID,
      merchant_request_id: response.data.MerchantRequestID,
    });

    res.json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        payment,
        mpesaResponse: response.data,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const checkPaymentStatus = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.params;

    // Find the payment
    const payment = await Payment.findOne({
      where: { checkout_request_id: checkoutRequestId },
      include: [{ model: Invoice, as: 'invoice' }],
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // If payment is already completed, return the status
    if (payment.status === 'completed') {
      return res.json({
        success: true,
        data: {
          status: 'completed',
          payment,
        },
      });
    }

    // Check payment status with M-Pesa
    const response = await mpesaService.checkPaymentStatus(checkoutRequestId);

    if (!response.success) {
      throw new BadRequestError('Failed to check payment status', response.error);
    }

    // Update payment status based on M-Pesa response
    const resultCode = response.data.ResultCode;
    let status = payment.status;
    let message = 'Payment status checked successfully';

    if (resultCode === '0') {
      // Payment completed successfully
      status = 'completed';
      message = 'Payment completed successfully';

      // Update payment record
      await payment.update({
        status,
        mpesa_receipt: response.data.MpesaReceiptNumber,
        transaction_time: response.data.TransactionDate,
        result_code: resultCode,
        result_desc: response.data.ResultDesc,
      });

      // Update invoice status if fully paid
      const totalPaid = await Payment.sum('amount', {
        where: {
          invoice_id: payment.invoice_id,
          status: 'completed',
        },
      });

      if (totalPaid >= payment.invoice.amount) {
        await payment.invoice.update({ status: 'paid' });
      }
    } else if (resultCode !== '1032') {
      // 1032 is the code for "Request cancelled by user"
      status = 'failed';
      message = 'Payment failed';

      await payment.update({
        status,
        result_code: resultCode,
        result_desc: response.data.ResultDesc,
      });
    }

    res.json({
      success: true,
      message,
      data: {
        status,
        payment: await payment.reload(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * M-Pesa callback handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const mpesaCallback = async (req, res, next) => {
  try {
    const callbackData = req.body;

    // Log the callback for debugging
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    // Process the callback
    await mpesaService.handleCallback(callbackData);

    // Send success response to M-Pesa
    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully',
    });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    
    // Send error response to M-Pesa
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: 'Error processing callback',
    });
  }
};

/**
 * Get payment history for an invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPaymentHistory = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    // Verify the invoice belongs to the user
    const invoice = await Invoice.findOne({
      where: { id: invoiceId, user_id: userId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Get all payments for the invoice
    const payments = await Payment.findAll({
      where: { invoice_id: invoiceId },
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPaymentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findOne({
      where: { id },
      include: [
        {
          model: Invoice,
          as: 'invoice',
          where: { user_id: userId },
          required: true,
        },
      ],
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};
