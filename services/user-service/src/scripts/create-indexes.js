const User = require('../models/User')

async function createIndexes() {
  try {
    // Ensure all indexes defined in schema are built
    await User.init()
    console.log('[user-service] Indexes created/verified for User collection')
    process.exit(0)
  } catch (error) {
    console.error('[user-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
