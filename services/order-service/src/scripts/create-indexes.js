const Order = require('../models/Order')

async function createIndexes() {
  try {
    await Order.init()
    console.log('[order-service] Indexes created/verified for Order collection')
    process.exit(0)
  } catch (error) {
    console.error('[order-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
