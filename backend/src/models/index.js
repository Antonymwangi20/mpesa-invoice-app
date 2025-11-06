import User from './User.js';
import Invoice from './Invoice.js';
import Payment from './Payment.js';

// Define associations
User.hasMany(Invoice, {
  foreignKey: 'user_id',
  as: 'invoices',
  onDelete: 'CASCADE',
});

Invoice.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Invoice.hasMany(Payment, {
  foreignKey: 'invoice_id',
  as: 'payments',
  onDelete: 'CASCADE',
});

Payment.belongsTo(Invoice, {
  foreignKey: 'invoice_id',
  as: 'invoice',
});

User.hasMany(Payment, {
  foreignKey: 'user_id',
  as: 'payments',
  onDelete: 'CASCADE',
});

Payment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

const models = {
  User,
  Invoice,
  Payment,
};

export default models;
