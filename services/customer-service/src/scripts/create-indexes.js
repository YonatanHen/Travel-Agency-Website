const Customer = require('../models/Customer')

async function createIndexes() {
  try {
    await Customer.init()
    console.log('[customer-service] Indexes created/verified for Customer collection')
    process.exit(0)
  } catch (error) {
    console.error('[customer-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
