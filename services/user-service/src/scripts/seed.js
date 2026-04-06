const bcrypt = require('bcryptjs')
const User = require('../models/User')

async function seed() {
  try {
    // Check if users already exist
    const count = await User.countDocuments()
    if (count > 0) {
      console.log('[user-service] Database already contains data. Skipping seed.')
      process.exit(0)
    }

    const users = [
      {
        username: 'admin',
        email: 'admin@travelagency.com',
        password: await bcrypt.hash('Admin123!', 10),
        role: 'Admin',
        isActive: true
      },
      {
        username: 'agent1',
        email: 'agent1@travelagency.com',
        password: await bcrypt.hash('Agent123!', 10),
        role: 'Agent',
        isActive: true
      },
      {
        username: 'customer1',
        email: 'customer1@example.com',
        password: await bcrypt.hash('Customer123!', 10),
        role: 'Customer',
        isActive: true
      }
    ]

    await User.insertMany(users)
    console.log('[user-service] Seeded initial users')
    process.exit(0)
  } catch (error) {
    console.error('[user-service] Seed failed:', error)
    process.exit(1)
  }
}

seed()
