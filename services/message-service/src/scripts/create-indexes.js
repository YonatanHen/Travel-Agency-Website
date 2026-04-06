const Message = require('../models/Message')

async function createIndexes() {
  try {
    await Message.init()
    console.log('[message-service] Indexes created/verified for Message collection')
    process.exit(0)
  } catch (error) {
    console.error('[message-service] Index creation failed:', error)
    process.exit(1)
  }
}

createIndexes()
