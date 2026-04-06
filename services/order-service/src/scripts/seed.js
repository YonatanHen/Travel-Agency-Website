const Order = require('../models/Order')
const { connectToMongoDB } = require('@travel-agency/shared-utils')

async function seed() {
  let connection = null

  try {
    // Connect to database
    const dbConfig = require('../utils/database')
    const config = require('@travel-agency/shared-config').get('order-service')

    connection = await dbConfig.connect(config.mongodb.url, config.mongodb.database)
    console.log('[order-service] Connected to MongoDB for seeding')

    // Check if orders already exist
    const count = await Order.countDocuments()
    if (count > 0) {
      console.log(`[order-service] Database already contains ${count} orders. Skipping seed.`)
      process.exit(0)
    }

    // Create sample orders
    const now = new Date()
    const orders = [
      {
        user: '64b7f8a1c2e8f2a1b2c3d4e5',
        userEmail: 'john.doe@example.com',
        package: '64b7f8a1c2e8f2a1b2c3d4e6',
        packageName: 'Paris Getaway',
        destination: 'Paris, France',
        travelDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'Confirmed',
        quantity: 2,
        unitPrice: 1200,
        totalPrice: 2400,
        customerNotes: 'Honeymoon trip - please make it special!'
      },
      {
        user: '64b7f8a1c2e8f2a1b2c3d4e7',
        userEmail: 'jane.smith@example.com',
        package: '64b7f8a1c2e8f2a1b2c3d4e8',
        packageName: 'Tokyo Adventure',
        destination: 'Tokyo, Japan',
        travelDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'Pending',
        quantity: 1,
        unitPrice: 2500,
        totalPrice: 2500,
        customerNotes: 'Vegetarian meal required'
      },
      {
        user: '64b7f8a1c2e8f2a1b2c3d4e9',
        userEmail: 'bob.wilson@example.com',
        package: '64b7f8a1c2e8f2a1b2c3d4ea',
        packageName: 'Maldives Paradise',
        destination: 'Maldives',
        travelDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        status: 'Confirmed',
        quantity: 2,
        unitPrice: 3500,
        totalPrice: 7000,
        customerNotes: 'Anniversary celebration'
      },
      {
        user: '64b7f8a1c2e8f2a1b2c3d4eb',
        userEmail: 'alice.jones@example.com',
        package: '64b7f8a1c2e8f2a1b2c3d4ec',
        packageName: 'New York City Tour',
        destination: 'New York, USA',
        travelDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: 'Canceled',
        quantity: 3,
        unitPrice: 800,
        totalPrice: 2400,
        customerNotes: 'Canceled due to illness',
        cancellationReason: 'Medical reasons - unable to travel',
        canceledAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }
    ]

    await Order.insertMany(orders)
    console.log(`[order-service] Seeded ${orders.length} orders`)

    // Print summary
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ])
    console.log('[order-service] Order statistics by status:', stats)

    process.exit(0)
  } catch (error) {
    console.error('[order-service] Seed failed:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.close()
      console.log('[order-service] MongoDB connection closed')
    }
  }
}

seed()
