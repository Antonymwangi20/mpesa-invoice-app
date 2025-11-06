import { Invoice, Payment } from '../models/index.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * Create a new invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createInvoice = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      amount,
      description,
      dueDate,
    } = req.body;

    // Create new invoice
    const invoice = await Invoice.create({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      amount,
      description,
      due_date: dueDate,
      status: 'draft',
      user_id: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all invoices for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getInvoices = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const where = { user_id: req.user.id };
    if (status) {
      where.status = status;
    }

    // Get invoices with pagination
    const { count, rows: invoices } = await Invoice.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'status', 'created_at'],
        },
      ],
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single invoice by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      where: { id, user_id: req.user.id },
      include: [
        {
          model: Payment,
          as: 'payments',
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a public invoice by public ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPublicInvoice = async (req, res, next) => {
  try {
    const { publicId } = req.params;

    const invoice = await Invoice.findOne({
      where: { public_id: publicId },
      include: [
        {
          model: Payment,
          as: 'payments',
          where: { status: 'completed' },
          required: false,
          attributes: ['id', 'amount', 'mpesa_receipt', 'transaction_time'],
        },
      ],
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Calculate amount paid
    const amountPaid = invoice.payments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0
    );

    const response = {
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        customer_phone: invoice.customer_phone,
        customer_email: invoice.customer_email,
        amount: invoice.amount,
        amount_paid: amountPaid,
        balance: invoice.amount - amountPaid,
        description: invoice.description,
        status: invoice.status,
        due_date: invoice.due_date,
        created_at: invoice.created_at,
      },
      payments: invoice.payments,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerPhone,
      customerEmail,
      amount,
      description,
      dueDate,
      status,
    } = req.body;

    const invoice = await Invoice.findOne({
      where: { id, user_id: req.user.id },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Prevent updating paid invoices
    if (invoice.status === 'paid') {
      throw new BadRequestError('Cannot update a paid invoice');
    }

    // Update invoice
    await invoice.update({
      customer_name: customerName || invoice.customer_name,
      customer_phone: customerPhone || invoice.customer_phone,
      customer_email: customerEmail || invoice.customer_email,
      amount: amount || invoice.amount,
      description: description || invoice.description,
      due_date: dueDate || invoice.due_date,
      status: status || invoice.status,
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      where: { id, user_id: req.user.id },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Prevent deleting invoices with payments
    const paymentCount = await Payment.count({
      where: { invoice_id: invoice.id },
    });

    if (paymentCount > 0) {
      throw new BadRequestError('Cannot delete an invoice with payments');
    }

    await invoice.destroy();

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send invoice to customer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const sendInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, phone } = req.body;

    const invoice = await Invoice.findOne({
      where: { id, user_id: req.user.id },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Update invoice status to 'sent'
    await invoice.update({ status: 'sent' });

    // TODO: Implement email/SMS sending logic here
    // This would typically integrate with an email service (e.g., SendGrid, Mailchimp)
    // and/or an SMS gateway

    res.json({
      success: true,
      message: 'Invoice sent successfully',
      data: {
        invoice,
        sentTo: { email, phone },
      },
    });
  } catch (error) {
    next(error);
  }
};
