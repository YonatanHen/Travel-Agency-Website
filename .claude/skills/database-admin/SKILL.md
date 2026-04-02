---
name: database
description: Design MongoDB schemas and queries for microservices. Each service owns its own database. Use Mongoose ODM with proper validation, indexes, lean queries, and aggregation pipelines. Prevent NoSQL injection.
---

## Database-per-Service Pattern

**Each microservice owns a separate database.** Do not share databases between services.

Database names:
- User Service: `travel_agency_users`
- Package Service: `travel_agency_packages`
- Order Service: `travel_agency_orders`
- Customer Service: `travel_agency_customers` (or uses User Service API only)
- Communication Service: `travel_agency_messages`

All connect to the same MongoDB instance but create separate databases. Configure via:
```javascript
mongoose.connect(process.env.MONGODB_URI + process.env.DATABASE_NAME)
```

## Connection Module Pattern

Create reusable connection module in each service:

`services/<service>/src/models/connection.js`:
```javascript
const mongoose = require('mongoose')

let db

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const dbName = process.env.DATABASE_NAME

  try {
    await mongoose.connect(uri, {
      dbName: dbName,
      // Other options: useNewUrlParser, useUnifiedTopology (default in mongoose 6+)
    })
    db = mongoose.connection
    console.log(`Connected to database: ${dbName}`)
  } catch (error) {
    console.error('Database connection error:', error)
    process.exit(1)
  }
}

// Optional: disconnect helper
const disconnectDB = async () => {
  await mongoose.disconnect()
}

module.exports = { db, connectDB, disconnectDB }
```

In `src/index.js`:
```javascript
const { connectDB } = require('./models/connection')

connectDB().catch(err => {
  console.error('Failed to connect to database:', err)
  process.exit(1)
})
```

## Schema Design

Use Mongoose schemas with validation:

```javascript
const mongoose = require('mongoose')

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Package name required'],
    trim: true
  },
  destination: {
    type: String,
    required: [true, 'Destination required'],
    index: true // Query optimization
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    required: true
  },
  quantity: {
    type: Number,
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  image: String,
  description: {
    type: String,
    maxlength: [1000, 'Description too long']
  }
}, {
  timestamps: true // Adds createdAt, updatedAt
})

module.exports = mongoose.model('Package', packageSchema)
```

## Indexes

Add indexes for frequently queried fields:

```javascript
destination: { type: String, index: true }
// Compound index:
{ destination: 1, startDate: 1, price: -1 }
```

Create indexes in schema or separately:
```javascript
packageSchema.index({ destination: 1, price: 1 })
```

## Query Optimization

**Use lean() for read-only queries** (returns plain JS objects, no Mongoose document overhead):
```javascript
const packages = await Package.find({ destination: 'Paris' }).lean()
```

**Projection**: Only fetch needed fields:
```javascript
const packages = await Package.find().select('name destination price')
```

**Pagination**: Always paginate for large datasets:
```javascript
const page = parseInt(req.query.page) || 1
const limit = parseInt(req.query.limit) || 10
const skip = (page - 1) * limit

const packages = await Package.find()
  .skip(skip)
  .limit(limit)
```

Return pagination metadata:
```json
{
  "data": [...],
  "page": 1,
  "limit": 10,
  "total": 150,
  "totalPages": 15
}
```

## Aggregation Pipeline

For complex queries (joins, transformations):

```javascript
const result = await Package.aggregate([
  { $match: { destination: 'Paris', price: { $gt: 100 } } },
  { $group: {
    _id: '$destination',
    avgPrice: { $avg: '$price' },
    count: { $sum: 1 }
  }},
  { $sort: { avgPrice: -1 } }
])
```

## Prevent NoSQL Injection

**Never** use string concatenation for queries:
```javascript
// BAD - vulnerable
const query = `{ destination: "${req.query.dest}" }`
Model.find(eval(query))

// GOOD - Mongoose sanitizes
Model.find({ destination: req.query.dest })
```

Mongoose automatically escapes values. Still, validate input:
```javascript
const { query } = require('express-validator')
router.get('/packages', [
  query('destination').optional().isString()
], async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid query parameters' })
  }
  const packages = await Package.find({ destination: req.query.destination })
  res.json(packages)
})
```

## Transactions (Optional)

For operations that must be atomic across collections (e.g., create order + decrement package):

```javascript
const session = await mongoose.startSession()
try {
  await session.withTransaction(async () => {
    await Order.create([order], { session })
    await Package.findOneAndUpdate(
      { name: order.packageName },
      { $inc: { quantity: -order.quantity } },
      { session }
    )
  })
} finally {
  session.endSession()
}
```

Note: Transactions require replica set (not standalone MongoDB). Use only if truly needed; otherwise, handle compensation logic.

## Migration Scripts

If you need to transform data or add fields, create migration scripts in `scripts/migrations/`:

```javascript
// scripts/migrations/add-isActive-to-users.js
const mongoose = require('mongoose')
require('dotenv').config()

const User = require('../services/user-service/src/models/User')

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI + process.env.DATABASE_NAME)
  const result = await User.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } }
  )
  console.log(`Updated ${result.modifiedCount} users`)
  await mongoose.disconnect()
}

migrate()
```

Run: `node scripts/migrations/add-isActive-to-users.js`

## Testing Database Code

Integration tests use real MongoDB (preferred). Unit tests mock Mongoose models:

```javascript
jest.mock('../../src/models/Package')
const Package = require('../../src/models/Package')

test('getAllPackages returns packages from DB', async () => {
  Package.find.mockResolvedValue([{ name: 'Paris', price: 1000 }])

  const response = await request(app).get('/packages')
  expect(response.status).toBe(200)
  expect(response.body).toHaveLength(1)
})
```

## Connection Strategy

In production, handle connection events:

```javascript
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err)
})

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected')
})

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected')
})
```

## Performance

- Use indexes for all query filters/sorts
- Limit result sets (skip + limit)
- Prefer lean() for read operations
- Cache frequent queries (Redis layer if needed)
- Avoid deep pagination (skip large offsets) - use cursor-based pagination with \`_id\` instead

## Do NOT

- Share collections between services
- Hardcode database names (use env vars)
- Use `.find()` without filters (dangerous)
- Store large binary data in MongoDB (use S3 for images/files)
- Run expensive aggregations in request path (make async)
- Forget indexes on fields used in queries
