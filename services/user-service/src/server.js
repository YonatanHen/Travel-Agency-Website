// Load environment variables only in non-test environments
// In tests, @shelf/jest-mongodb provides MONGODB_URL
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config()
}

const { connectToMongoDB, isConnected, disconnect } = require('@travel-agency/shared-utils')
const config = require('@travel-agency/shared-config').get('user-service')
const app = require('./app')

// Start server and connect to database
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
    const User = require('./models/User')
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

module.exports = { startServer }