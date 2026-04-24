// Load environment variables only in non-test environments
// In tests, @shelf/jest-mongodb provides MONGODB_URL
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config()
}

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const { AppError } = require('@travel-agency/shared-errors')

const authRouter = require('./routes/auth')

const app = express()

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Rate limiting (skip in test mode to avoid test interference)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  })
  app.use('/api/', limiter)
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'user-service'
  })
})

// API routes
app.use('/api/auth', authRouter)

// 404 handler
app.use('*', (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404))
})

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500
  const message = err.message || 'Internal server error'

  // Log error for debugging
  console.error(`[user-service] ${req.method} ${req.path}`, err)

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
})

module.exports = app