require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');


const { pool, testConnection, initializeTables } = require('./config/database');
const { errorHandler } = require('./middleware/error.middleware');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const customerRoutes = require('./routes/customers.routes');
const serviceRoutes = require('./routes/services.routes');
const bookingRoutes = require('./routes/bookings.routes');
const billingRoutes = require('./routes/billing.routes');
const expenseRoutes = require('./routes/expenses.routes');
const reportRoutes = require('./routes/reports.routes');
const settingsRoutes = require('./routes/settings.routes');
const membershipsRoutes = require('./routes/memberships.routes');
const staffRoutes = require('./routes/staff.routes');
const advancedBIRoutes = require('./routes/advanced-bi.routes');
const app = express();
const PORT = process.env.PORT || 3000;
const calendarRoutes = require('./routes/calendar.routes');

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",   // needed for inline event handlers in modules
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://sites.super.myninja.ai",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com",
      ],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for CDN fonts/images
})); // Secure HTTP headers

// CORS configuration (ensure CORS_ORIGIN is set in your .env for production)
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};
app.use(cors(corsOptions));

// Body parsing with payload limits to mitigate attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP Parameter Pollution protection
app.use(hpp());

// API Rate Limiting to prevent brute-force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { success: false, error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all API routes
app.use('/api/', apiLimiter);

// Serve static files from frontend
// Pathing fix: assume 'frontend' and 'uploads' are in the same root as server.js
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Lazy-initialize DB only on the first request to save "cold start" time
app.use(async (req, res, next) => {
  try {
    // This runs once per "warm" instance
    if (app.get('db_initialized')) return next();
    
    await testConnection();
    await initializeTables();
    
    app.set('db_initialized', true);
    next();
  } catch (error) {
    next(error);
  }
});

// // API Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/calendar', calendarRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/services', serviceRoutes);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/billing', billingRoutes);
// app.use('/api/expenses', expenseRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/settings', settingsRoutes);
// app.use('/api/memberships', membershipsRoutes);
// app.use('/api/staff', staffRoutes);

// ================= API ROUTES =================

// Specific routes FIRST
app.use('/api/calendar', calendarRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/memberships', membershipsRoutes);
app.use('/api/bi', advancedBIRoutes);

// Generic routes LAST
app.use('/api/customers', customerRoutes);
// Auth can be anywhere
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);


// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/app.html'));
});

// Error handling
app.use(errorHandler);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Only listen if running locally or on a standard non-serverless host
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`Local server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Frontend URL: http://localhost:${PORT}`);
    logger.info(`API URL: http://localhost:${PORT}/api`);
  });
}

// CRITICAL: Export for Vercel
module.exports = app;