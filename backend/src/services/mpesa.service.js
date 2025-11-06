import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Payment from '../models/Payment.js';

dotenv.config();

const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

const API_BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let accessToken = '';
let tokenExpiry = 0;

/**
 * Generate M-Pesa access token
 */
const generateAccessToken = async () => {
  try {
    // Check if token is still valid (expires in 50 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (accessToken && now < tokenExpiry - 600) {
      return accessToken;
    }

    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(`${API_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    accessToken = response.data.access_token;
    tokenExpiry = now + (response.data.expires_in || 3599);
    return accessToken;
  } catch (error) {
    console.error('Error generating access token:', error.response?.data || error.message);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

/**
 * Generate password for STK Push
 */
const generatePassword = (shortcode, passkey, timestamp) => {
  const data = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(data).toString('base64');
};

/**
 * Generate timestamp in the format YYYYMMDDHHmmss
 */
const generateTimestamp = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
};

/**
 * Initiate STK Push payment
 * @param {string} phoneNumber - Customer phone number in format 2547XXXXXXXX
 * @param {number} amount - Amount to be paid
 * @param {string} accountReference - Account reference
 * @param {string} description - Payment description
 * @param {string} callbackUrl - Callback URL for payment confirmation
 * @returns {Promise<Object>} - STK Push response
 */
const initiateSTKPush = async (phoneNumber, amount, accountReference, description, callbackUrl = CALLBACK_URL) => {
  try {
    const token = await generateAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(SHORTCODE, PASSKEY, timestamp);
    
    // Format phone number to 2547XXXXXXXX
    const formattedPhone = phoneNumber.startsWith('0') 
      ? `254${phoneNumber.substring(1)}` 
      : phoneNumber.startsWith('+') 
        ? phoneNumber.substring(1) 
        : phoneNumber;

    const response = await axios.post(
      `${API_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: description,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Verify payment status
 * @param {string} checkoutRequestId - The checkout request ID from STK Push
 * @returns {Promise<Object>} - Payment status
 */
const checkPaymentStatus = async (checkoutRequestId) => {
  try {
    const token = await generateAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(SHORTCODE, PASSKEY, timestamp);

    const response = await axios.post(
      `${API_BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Payment Status Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Handle M-Pesa callback
 * @param {Object} callbackData - Callback data from M-Pesa
 * @returns {Promise<Object>} - Processing result
 */
const handleCallback = async (callbackData) => {
  try {
    // Find payment by checkout request ID
    const payment = await Payment.findOne({
      where: { checkout_request_id: callbackData.Body.stkCallback.CheckoutRequestID },
    });

    if (!payment) {
      console.error('Payment not found for callback:', callbackData);
      return { success: false, error: 'Payment not found' };
    }

    const callback = callbackData.Body.stkCallback;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    // Update payment status based on result code
    if (resultCode === 0) {
      // Success
      const metadata = callback.CallbackMetadata?.Item || [];
      const receipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value || '';
      const amount = metadata.find(item => item.Name === 'Amount')?.Value || 0;
      const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value || '';
      const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value || '';

      await payment.update({
        status: 'completed',
        mpesa_receipt: receipt,
        amount: amount,
        phone_number: phone,
        transaction_time: transactionDate ? new Date(transactionDate) : null,
        result_code: resultCode,
        result_desc: resultDesc,
        callback_metadata: callbackData,
      });

      // Update invoice status to paid if full amount is paid
      const invoice = await payment.getInvoice();
      const totalPaid = await Payment.sum('amount', {
        where: {
          invoice_id: invoice.id,
          status: 'completed',
        },
      });

      if (totalPaid >= invoice.amount) {
        await invoice.update({ status: 'paid' });
      }
    } else {
      // Failed
      await payment.update({
        status: 'failed',
        result_code: resultCode,
        result_desc: resultDesc,
        callback_metadata: callbackData,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing callback:', error);
    return { success: false, error: error.message };
  }
};

export default {
  initiateSTKPush,
  checkPaymentStatus,
  handleCallback,
  generateAccessToken,
};
