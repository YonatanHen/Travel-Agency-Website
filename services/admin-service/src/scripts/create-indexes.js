const Admin = require('../models/Admin')

async function createIndexes() {
  try {
    await Admin.init()
    console.log('[admin-service] Indexes created/verified for Admin collection')
    process.exit(0)
  } catch (error) {
    console.error('[admin-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
