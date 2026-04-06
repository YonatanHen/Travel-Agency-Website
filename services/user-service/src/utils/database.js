const { DatabaseService } = require('@travel-agency/shared-utils')

/**
 * Database service singleton for user-service.
 * Handles MongoDB connection lifecycle.
 */
module.exports = new DatabaseService()
