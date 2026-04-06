/**
 * One-time migration script to copy data from monolith MongoDB collections
 * to the new microservice databases.
 *
 * Usage:
 * 1. Update migration-config.json with source and target connection details.
 * 2. Run: node scripts/migrate-data.js
 */

const { MongoClient } = require('mongodb')
const path = require('path')
const config = require(path.join(__dirname, 'migration-config.json'))

async function migrate() {
  let sourceClient
  let targetClients = {}

  try {
    console.log('Starting migration...')

    // Connect to source monolith DB
    sourceClient = await MongoClient.connect(config.source.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    const sourceDb = sourceClient.db(config.source.dbName)
    console.log(`Connected to source DB: ${config.source.dbName}`)

    // Migrate Users -> user-service DB
    await migrateCollection({
      sourceDb,
      sourceColl: 'users',
      targetConfig: config.target.user,
      targetColl: 'users',
      transform: (doc) => ({
        username: doc.username,
        email: doc.email.toLowerCase(),
        password: doc.password, // Already hashed
        role: doc.role || 'Customer',
        isActive: doc.isActive !== false
      })
    })

    // Migrate Packages -> package-service DB
    await migrateCollection({
      sourceDb,
      sourceColl: 'packages',
      targetConfig: config.target.package,
      targetColl: 'packages',
      transform: (doc) => ({
        name: doc.name,
        description: doc.description,
        price: doc.price,
        quantity: doc.quantity || 0,
        destination: doc.destination,
        duration: doc.duration,
        imageUrl: doc.imageUrl,
        amenities: doc.amenities || [],
        rating: doc.rating || 0,
        reviewCount: doc.reviewCount || 0,
        isActive: true
      })
    })

    // Migrate Orders -> order-service DB
    await migrateCollection({
      sourceDb,
      sourceColl: 'orders',
      targetConfig: config.target.order,
      targetColl: 'orders',
      transform: (doc) => ({
        user: doc.user,
        userEmail: doc.userEmail || '',
        package: doc.package,
        packageName: doc.packageName,
        destination: doc.destination,
        travelDate: doc.travelDate,
        status: doc.status || 'Pending',
        quantity: doc.quantity || 1,
        unitPrice: doc.unitPrice || 0,
        totalPrice: doc.totalPrice || 0,
        customerNotes: doc.customerNotes,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      })
    })

    // Migrate Customers -> customer-service DB
    await migrateCollection({
      sourceDb,
      sourceColl: 'customers',
      targetConfig: config.target.customer,
      targetColl: 'customers',
      transform: (doc) => ({
        userId: doc.userId || doc.user,
        username: doc.username,
        email: doc.email,
        phone: doc.phone,
        address: doc.address,
        preferences: doc.preferences || {},
        loyaltyPoints: doc.loyaltyPoints || 0,
        loyaltyTier: doc.loyaltyTier || 'Bronze',
        totalBookings: doc.totalBookings || 0,
        totalSpent: doc.totalSpent || 0,
        lastBookingDate: doc.lastBookingDate,
        isActive: true
      })
    })

    // Migrate Messages -> message-service DB
    await migrateCollection({
      sourceDb,
      sourceColl: 'messages',
      targetConfig: config.target.message,
      targetColl: 'messages',
      transform: (doc) => ({
        name: doc.name,
        email: doc.email,
        subject: doc.subject,
        message: doc.message,
        phone: doc.phone,
        priority: doc.priority || 'Normal',
        isRead: doc.isRead || false,
        userId: doc.userId,
        metadata: doc.metadata || {}
      })
    })

    // Admins are users with role=Admin, no separate migration needed

    console.log('✅ Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    if (sourceClient) await sourceClient.close()
    for (const key in targetClients) {
      await targetClients[key].close()
    }
  }
}

/**
 * Helper to migrate a single collection
 */
async function migrateCollection({ sourceDb, sourceColl, targetConfig, targetColl, transform }) {
  console.log(`Migrating ${sourceColl} -> ${targetColl}...`)

  const targetClient = await MongoClient.connect(targetConfig.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  targetClients[targetColl] = targetClient
  const targetDb = targetClient.db(targetConfig.dbName)

  const docs = await sourceDb.collection(sourceColl).find({}).toArray()

  if (docs.length === 0) {
    console.log(`  Skipping ${sourceColl}: empty source collection`)
    await targetClient.close()
    delete targetClients[targetColl]
    return
  }

  const transformed = docs.map(transform)

  await targetDb.collection(targetColl).deleteMany({}) // Clear existing
  await targetDb.collection(targetColl).insertMany(transformed)

  console.log(`  ✓ Migrated ${transformed.length} documents`)

  await targetClient.close()
  delete targetClients[targetColl]
}

migrate()
