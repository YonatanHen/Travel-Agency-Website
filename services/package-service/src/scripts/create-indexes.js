const Package = require('../models/Package')

async function createIndexes() {
  try {
    await Package.init()
    console.log('[package-service] Indexes created/verified for Package collection')
    process.exit(0)
  } catch (error) {
    console.error('[package-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
