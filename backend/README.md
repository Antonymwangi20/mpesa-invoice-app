# M-Pesa Invoice Payment System - Backend

A backend API for creating invoices and accepting M-Pesa payments in Kenya.

## Features

- User authentication with JWT
- Create and manage invoices
- M-Pesa STK Push integration (Lipa Na M-Pesa)
- Real-time payment callbacks
- Public payment links
- Payment status tracking
- SQLite/PostgreSQL support

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- M-Pesa Daraja API credentials (for production)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd backend
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Set up environment variables

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL=sqlite://./database.sqlite
# For PostgreSQL, use:
# DATABASE_URL=postgres://username:password@localhost:5432/mpesa_invoice

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=30d

# M-Pesa Configuration (Sandbox)
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/callback
MPESA_ENVIRONMENT=sandbox  # or 'production' for live environment

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Start the development server

```bash
npm run dev
# or
yarn dev
```

The server will start on `http://localhost:5000` by default.

## API Documentation

Once the server is running, you can access the API documentation at:

- Swagger UI: `http://localhost:5000/api-docs`
- API Base URL: `http://localhost:5000/api`

## Available Scripts

- `npm run dev` - Start the development server with hot-reload
- `npm start` - Start the production server
- `npm test` - Run tests (coming soon)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Database

By default, the application uses SQLite for development. For production, it's recommended to use PostgreSQL.

### Migrations

To create and run migrations:

```bash
# Create a new migration
npx sequelize-cli migration:generate --name migration-name

# Run migrations
npx sequelize-cli db:migrate

# Rollback the last migration
npx sequelize-cli db:migrate:undo
```

## Deployment

### Using Docker

1. Build the Docker image:

```bash
docker build -t mpesa-invoice-backend .
```

2. Run the container:

```bash
docker run -p 5000:5000 --env-file .env mpesa-invoice-backend
```

### Using PM2 (Production)

1. Install PM2 globally:

```bash
npm install -g pm2
```

2. Start the application:

```bash
NODE_ENV=production pm2 start src/server.js --name "mpesa-invoice-backend"
```

3. Set up PM2 to start on system boot:

```bash
pm2 startup
pm2 save
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Port to run the server on | 5000 |
| NODE_ENV | Environment (development, production) | development |
| DATABASE_URL | Database connection URL | sqlite://./database.sqlite |
| JWT_SECRET | Secret key for JWT | - |
| JWT_EXPIRES_IN | JWT expiration time | 30d |
| MPESA_CONSUMER_KEY | M-Pesa API consumer key | - |
| MPESA_CONSUMER_SECRET | M-Pesa API consumer secret | - |
| MPESA_SHORTCODE | M-Pesa business shortcode | - |
| MPESA_PASSKEY | M-Pesa passkey | - |
| MPESA_CALLBACK_URL | Callback URL for M-Pesa | - |
| MPESA_ENVIRONMENT | M-Pesa environment (sandbox/production) | sandbox |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Invoices

- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create a new invoice
- `GET /api/invoices/:id` - Get invoice by ID
- `PUT /api/invoices/:id` - Update an invoice
- `DELETE /api/invoices/:id` - Delete an invoice
- `POST /api/invoices/:id/send` - Send invoice to customer
- `GET /api/invoices/public/:publicId` - Get public invoice (no auth required)

### Payments

- `POST /api/payments/initiate` - Initiate M-Pesa payment
- `GET /api/payments/status/:checkoutRequestId` - Check payment status
- `GET /api/payments/invoice/:invoiceId` - Get payment history for an invoice
- `GET /api/payments/:id` - Get payment details by ID
- `POST /api/payments/callback` - M-Pesa callback endpoint (handled automatically)

## Testing

To run tests:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository.
