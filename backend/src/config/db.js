import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL || 'sqlite://./database.sqlite';

const sequelize = new Sequelize(databaseUrl, {
  dialect: databaseUrl.startsWith('postgres') ? 'postgres' : 'sqlite',
  logging: env === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

export default sequelize;
