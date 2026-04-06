const mongoose = require('mongoose')
const { AppError } = require('@travel-agency/shared-errors')

/**
 * Connect to MongoDB using provided URI and database name
 * @param {string} uri - MongoDB connection string (with credentials)
 * @param {string} dbName - Database name
 * @param {Object} options - Optional mongoose connect options
 * @returns {Promise< mongoose.Connection >}
 */
async function connectToMongoDB(uri, dbName, options = {}) {
  if (!uri) {
    throw new AppError('MongoDB URI is required', 400)
  }
  if (!dbName) {
    throw new AppError('Database name is required', 400)
  }

  const defaultOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    ...options
  }

  try {
    const connection = await mongoose.connect(uri, {
      ...defaultOptions,
      dbName
    })

    console.log(`[${process.env.SERVICE_NAME || 'service'}] MongoDB connected: ${dbName}`)
    return connection
  } catch (error) {
    console.error('[database] Connection error:', error)
    throw new AppError(`Database connection failed: ${error.message}`, 500)
  }
}

/**
 * Check if mongoose is connected
 * @returns {boolean}
 */
function isConnected() {
  return mongoose.connection.readyState === 1
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
async function disconnect() {
  await mongoose.disconnect()
  console.log('MongoDB disconnected')
}

/**
 * DatabaseService - Singleton for managing MongoDB connection.
 * Use this in services to connect/disconnect and check connection status.
 */
class DatabaseService {
  constructor() {
    this.connection = null
  }

  /**
   * Connect to MongoDB
   * @param {string} uri - MongoDB connection string
   * @param {string} dbName - Database name
   * @param {Object} options - Optional mongoose options
   * @returns {Promise<mongoose.Connection>}
   */
  async connect(uri, dbName, options = {}) {
    if (!uri) {
      throw new AppError('MongoDB URI is required', 400)
    }
    if (!dbName) {
      throw new AppError('Database name is required', 400)
    }

    const defaultOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      ...options
    }

    try {
      this.connection = await mongoose.connect(uri, {
        ...defaultOptions,
        dbName
      })
      const serviceName = process.env.SERVICE_NAME || 'service'
      console.log(`[${serviceName}] MongoDB connected: ${dbName}`)
      return this.connection
    } catch (error) {
      console.error('[database] Connection error:', error)
      throw new AppError(`Database connection failed: ${error.message}`, 500)
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect()
      this.connection = null
      console.log('MongoDB disconnected')
    }
  }

  /**
   * Ping database to check health
   * @returns {Promise<boolean>}
   */
  async ping() {
    if (!this.connection) {
      throw new Error('Not connected')
    }
    await this.connection.db.admin().ping()
    return true
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connection && this.connection.readyState === 1
  }
}

// Export both function and class for flexibility
module.exports = {
  connectToMongoDB,
  isConnected,
  disconnect,
  mongoose,
  DatabaseService
}
