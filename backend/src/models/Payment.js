import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mpesa_receipt: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  account_reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transaction_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 
      'processing', 
      'completed', 
      'failed', 
      'cancelled'
    ),
    defaultValue: 'pending',
  },
  checkout_request_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  merchant_request_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  result_code: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  result_desc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  callback_metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'invoices',
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['mpesa_receipt'],
    },
    {
      fields: ['phone_number'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['checkout_request_id'],
    },
    {
      fields: ['merchant_request_id'],
    },
  ],
});

export default Payment;
