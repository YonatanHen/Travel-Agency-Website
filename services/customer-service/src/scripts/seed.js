const Customer = require('../models/Customer')
const { connectToMongoDB } = require('@travel-agency/shared-utils')

async function seed() {
  let connection = null

  try {
    // Connect to database
    const dbConfig = require('../utils/database')
    const config = require('@travel-agency/shared-config').get('customer-service')

    connection = await dbConfig.connect(config.mongodb.url, config.mongodb.database)
    console.log('[customer-service] Connected to MongoDB for seeding')

    // Check if customers already exist
    const count = await Customer.countDocuments()
    if (count > 0) {
      console.log(`[customer-service] Database already contains ${count} customers. Skipping seed.`)
      process.exit(0)
    }

    // Create sample customers
    const customers = [
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4e5',
        email: 'john.doe@example.com',
        phone: '+1-555-0101',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        preferences: {
          newsletterSubscribed: true,
          contactMethod: 'email',
          language: 'en'
        },
        loyaltyTier: 'Gold',
        totalBookings: 5,
        totalSpent: 4500,
        loyaltyPoints: 45,
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4e6',
        email: 'jane.smith@example.com',
        phone: '+1-555-0102',
        address: {
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'USA'
        },
        preferences: {
          newsletterSubscribed: true,
          contactMethod: 'sms',
          language: 'en'
        },
        loyaltyTier: 'Platinum',
        totalBookings: 12,
        totalSpent: 15000,
        loyaltyPoints: 150,
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4e7',
        email: 'bob.wilson@example.com',
        phone: '+1-555-0103',
        address: {
          street: '789 Pine Rd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'USA'
        },
        preferences: {
          newsletterSubscribed: false,
          contactMethod: 'email',
          language: 'en'
        },
        loyaltyTier: 'Silver',
        totalBookings: 2,
        totalSpent: 800,
        loyaltyPoints: 8,
        isActive: true
      },
      {
        userId: '64b7f8a1c2e8f2a1b2c3d4e8',
        email: 'alice.jones@example.com',
        phone: '+1-555-0104',
        address: {
          street: '321 Elm St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          country: 'USA'
        },
        preferences: {
          newsletterSubscribed: true,
          contactMethod: 'push',
          language: 'en'
        },
        loyaltyTier: 'Bronze',
        totalBookings: 1,
        totalSpent: 300,
        loyaltyPoints: 3,
        isActive: true
      }
    ]

    await Customer.insertMany(customers)
    console.log(`[customer-service] Seeded ${customers.length} customers`)

    // Print summary
    const stats = await Customer.aggregate([
      {
        $group: {
          _id: '$loyaltyTier',
          count: { $sum: 1 },
          avgSpent: { $avg: '$totalSpent' }
        }
      }
    ])
    console.log('[customer-service] Customer statistics by tier:', stats)

    process.exit(0)
  } catch (error) {
    console.error('[customer-service] Seed failed:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.close()
      console.log('[customer-service] MongoDB connection closed')
    }
  }
}

seed()
