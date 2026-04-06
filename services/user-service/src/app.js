// Load environment variables only in non-test environments
// In tests, @shelf/jest-mongodb provides MONGODB_URL
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config()
}

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const { connectToMongoDB, isConnected, disconnect } = require('@travel-agency/shared-utils')
const { AppError } = require('@travel-agency/shared-errors')
const config = require('@travel-agency/shared-config').get('user-service')

const authRouter = require('./routes/auth')
const User = require('./models/User')

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
    service: 'user-service',
    database: isConnected() ? 'connected' : 'disconnected'
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

// Start server (used by prod and tests)
async function startServer() {
  try {
    // Connect to database only if not already connected (test preset may have connected already)
    if (!isConnected()) {
      const dbConfig = config.mongodb
      await connectToMongoDB(dbConfig.url, dbConfig.database)
      console.log('[user-service] MongoDB connected')
    } else {
      console.log('[user-service] Using existing MongoDB connection')
    }

    // Ensure indexes
    await User.init()
    console.log('[user-service] Database indexes created')

    // Start server
    const port = config.server?.port || process.env.PORT || 3002
    const server = app.listen(port, () => {
      console.log(`[user-service] Server running on port ${port}`)
      console.log(`[user-service] Environment: ${process.env.NODE_ENV || 'development'}`)
    })

    return server
  } catch (error) {
    console.error('[user-service] Failed to start:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[user-service] SIGTERM received, shutting down gracefully')
  await disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[user-service] SIGINT received, shutting down gracefully')
  await disconnect()
  process.exit(0)
})

// Auto-start if run directly (development/production)
// In test mode, we start manually in beforeAll
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer()
}

// Export the Express app as the main export (for Supertest and other requires)
// Also attach startServer as a named export for advanced usage
module.exports = app
module.exports.start = startServer
