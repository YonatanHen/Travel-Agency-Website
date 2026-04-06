const Admin = require('../models/Admin')
const { connectToMongoDB } = require('@travel-agency/shared-utils')

async function seed() {
  let connection = null

  try {
    // Connect to database
    const dbConfig = require('../utils/database')
    const config = require('@travel-agency/shared-config').get('admin-service')

    connection = await dbConfig.connect(config.mongodb.url, config.mongodb.database)
    console.log('[admin-service] Connected to MongoDB for seeding')

    // Check if admins already exist
    const count = await Admin.countDocuments()
    if (count > 0) {
      console.log(`[admin-service] Database already contains ${count} admins. Skipping seed.`)
      process.exit(0)
    }

    // Create sample admin/agent accounts
    const admins = [
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4f1',
        username: 'superadmin',
        email: 'superadmin@travelagency.com',
        role: 'SuperAdmin',
        department: 'Operations',
        permissions: [],
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4f2',
        username: 'jane.admin',
        email: 'jane.admin@travelagency.com',
        role: 'Admin',
        department: 'Customer Service',
        permissions: [
          { resource: 'users', actions: ['read', 'write'] },
          { resource: 'packages', actions: ['read', 'write'] },
          { resource: 'orders', actions: ['read', 'write', 'delete'] },
          { resource: 'customers', actions: ['read', 'write'] }
        ],
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4f3',
        username: 'agent.mike',
        email: 'mike@travelagency.com',
        role: 'Agent',
        department: 'Sales',
        permissions: [
          { resource: 'packages', actions: ['read'] },
          { resource: 'orders', actions: ['read', 'write'] },
          { resource: 'customers', actions: ['read'] }
        ],
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4f4',
        username: 'agent.sarah',
        email: 'sarah@travelagency.com',
        role: 'Agent',
        department: 'Marketing',
        permissions: [
          { resource: 'packages', actions: ['read'] },
          { resource: 'messages', actions: ['read', 'write'] }
        ],
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4f5',
        username: 'inactive.agent',
        email: 'inactive@travelagency.com',
        role: 'Agent',
        department: 'Finance',
        permissions: [
          { resource: 'orders', actions: ['read'] },
          { resource: 'customers', actions: ['read'] }
        ],
        isActive: false
      }
    ]

    await Admin.insertMany(admins)
    console.log(`[admin-service] Seeded ${admins.length} admin accounts`)

    // Print summary
    const stats = await Admin.getDashboardStats()
    console.log('[admin-service] Admin statistics by role:', stats)

    const activeAgents = await Admin.findAgents()
    console.log(`[admin-service] Active agents count: ${activeAgents.length}`)

    process.exit(0)
  } catch (error) {
    console.error('[admin-service] Seed failed:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.close()
      console.log('[admin-service] MongoDB connection closed')
    }
  }
}

seed()
