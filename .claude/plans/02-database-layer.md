# Plan 02: Database Layer - Schemas & Repository Pattern

**Phase**: 1 - Database Layer
**Estimated Time**: 4-6 hours
**Dependencies**: Plan 01 (Infrastructure) must be complete; MongoDB pods running in K8s

---

## AI Context

**What**: Define MongoDB schemas (Mongoose) for each service's database, implement BaseRepository with dependency injection, create connection utilities, and seed initial data.

**Why**: Each microservice owns its database entirely. No shared collections. Repository pattern abstracts data access, enabling:
- Easy testing with mocks
- Future DB migration (MongoDB → PostgreSQL)
- Clean separation of concerns (Services never touch DB directly)

**Output**:
- Mongoose schemas for: User, Package, Order, Customer, Message, Admin
- `BaseRepository` abstract class
- Concrete repositories: `UserRepository`, `PackageRepository`, etc.
- Database connection service with DI
- K8s init containers for DB initialization (indexes, seed data)
- Migration scripts to copy data from monolith DB (one-time)

---

## Human Summary (Quick Read)

### What This Plan Does
- ✅ Defines 6 Mongoose schemas with validation
- ✅ Implements Repository pattern (CRUD operations abstracted)
- ✅ Creates BaseRepository with common methods (find, findById, save, delete)
- ✅ Sets up MongoDB connection with connection pooling per service
- ✅ Adds database initialization (indexes for query performance)
- ✅ Creates test repositories with in-memory MongoDB

### Key Decisions
- **ODM**: Mongoose (already in use, keeps code familiar)
- **Pattern**: Repository per entity (CRUD + custom queries only)
- **Validation**: Mongoose schema validators (required, min/max, custom)
- **Indexes**: Create on frequently queried fields (email, username, status)
- **Connections**: Each service creates its own connection (not shared)
- **Testing**: Use `@shelf/jest-mongodb` or `mongodb-memory-server`

### Database Isolation
Each service gets its own MongoDB database with ONLY its collections:
- **User Service DB**: `users` collection
- **Package Service DB**: `packages` collection
- **Order Service DB**: `orders` collection
- **Customer Service DB**: `customers` collection (or view into users)
- **Message Service DB**: `messages` collection
- **Admin Service DB**: `admins`, `agents` collections (or query User Service)

⚠️ **Important**: No service can directly query another service's database. Must call API.

---

## Schemas Overview

### 1. User Schema
```javascript
{
  username: String (required, unique, indexed)
  email: String (required, unique, indexed)
  password: String (required, hashed bcrypt)
  role: String (enum: ['Customer', 'Agent', 'Admin'], default: 'Customer', indexed)
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ username: 1 }` (unique)
- `{ email: 1 }` (unique)
- `{ role: 1 }`

### 2. Package Schema
```javascript
{
  name: String (required, unique)
  description: String (required)
  price: Number (required, min: 0)
  quantity: Number (required, min: 0)  // Available spots
  url: String (required, URL validation)
  rating: Number (min: 0, max: 5, default: 0)
  packageDates: [Date]  // Optional: available dates
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ name: 1 }` (unique)
- `{ rating: -1 }` (for sorting by rating)

### 3. Order Schema
```javascript
{
  user: ObjectId (ref: User, indexed)  // Who placed order
  userEmail: String (denormalized, for quick lookup)
  package: ObjectId (ref: Package, required, indexed)
  packageName: String (denormalized)
  destination: String
  travelDate: Date (required)
  status: String (enum: ['Pending', 'Confirmed', 'Canceled'], default: 'Pending', indexed)
  quantity: Number (default: 1)
  totalPrice: Number (required)
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ user: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`
- `{ package: 1 }`

**Note**: Denormalized fields (userEmail, packageName) for performance; update via application logic when referenced entities change.

### 4. Customer Schema
**Option A: Subset of users** (recommended for simplicity):
```javascript
{
  userId: ObjectId (ref: User, unique)  // Links to User Service DB
  // OR if separate DB, duplicate:
  username: String
  email: String
  phone: String
  address: String
  preferences: {}
  createdAt: Date
}
```

**Option B: Separate DB with sync** (more complex, shows advanced patterns):
- Service subscribes to `user.created` and `user.updated` events via RabbitMQ
- Maintains denormalized customer profile in own DB

**Decision**: For simplicity, Customer Service queries User Service directly (no local customer collection). But if offline capability needed, use Option B with event sync.

**Implementation**: We'll implement Option B for portfolio impressiveness:
- Customer Service listens to `user.created`, `user.updated`, `user.deleted`
- Maintains `customers` collection with subset of user data + travel preferences
- Can be queried without calling User Service (performance)

### 5. Message Schema
```javascript
{
  name: String (required)
  email: String (required)
  subject: String (required)
  message: String (required)
  read: Boolean (default: false, indexed)
  createdAt: Date
  repliedAt: Date
  repliedBy: ObjectId (ref: Admin)
}
```

**Indexes**:
- `{ read: 1, createdAt: -1 }`
- `{ email: 1 }`

### 6. Admin Schema
Similar to User but with admin-specific fields:
```javascript
{
  userId: ObjectId (ref: User)  // Admin is also a User
  department: String (enum: ['Support', 'Sales', 'Operations', 'SuperAdmin'])
  permissions: [String]  // Array of allowed actions
  lastLogin: Date
}
```

**Note**: Could also be just a User with role 'Admin'. No separate collection needed. Admin Service queries User Service.

**Decision**: Keep admins as Users with role='Admin'. Admin Service aggregates data from User Service.

---

## Detailed Steps

### Task 02-01: Define Mongoose Schemas

**Steps**:

1. Create schema files in each service's `src/models/` directory.

**Example: `services/user-service/src/models/User.js`**:
```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['Customer', 'Agent', 'Admin'],
      message: 'Role must be Customer, Agent, or Admin'
    },
    default: 'Customer',
    index: true
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

module.exports = mongoose.model('User', userSchema);
```

2. Repeat for all 6 entities (Package, Order, etc.) following similar patterns.

3. Add schema-level indexes as shown above (Mongoose `index: true`).

4. Add custom validation where needed (e.g., price > 0, rating range).

**Files**:
- `services/user-service/src/models/User.js`
- `services/package-service/src/models/Package.js`
- `services/order-service/src/models/Order.js`
- `services/customer-service/src/models/Customer.js`
- `services/message-service/src/models/Message.js`
- (admin service may not need separate model)

---

### Task 02-02: Create BaseRepository

**Steps**:

Create `services/*/src/repositories/BaseRepository.js`:

```javascript
const { AppError } = require('@travel-agency/shared-errors');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findAll(query = {}, options = {}) {
    const { limit, skip, sort } = options;
    const cursor = this.model.find(query);

    if (limit) cursor.limit(limit);
    if (skip) cursor.skip(skip);
    if (sort) cursor.sort(sort);

    return await cursor.exec();
  }

  async findById(id) {
    if (!id || !this.model.schema.path('_id')) {
      throw new AppError('Invalid ID', 400);
    }
    const doc = await this.model.findById(id).exec();
    if (!doc) {
      throw new AppError('Resource not found', 404);
    }
    return doc;
  }

  async create(data) {
    const doc = new this.model(data);
    await doc.validate();
    await doc.save();
    return doc;
  }

  async update(id, updates) {
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();

    if (!doc) {
      throw new AppError('Resource not found', 404);
    }
    return doc;
  }

  async delete(id) {
    const result = await this.model.findByIdAndDelete(id).exec();
    if (!result) {
      throw new AppError('Resource not found', 404);
    }
    return result;
  }

  async count(query = {}) {
    return await this.model.countDocuments(query).exec();
  }

  async exists(query) {
    return await this.model.exists(query).exec();
  }
}

module.exports = BaseRepository;
```

**Files**: Each service gets `src/repositories/BaseRepository.js` (can be shared via `@travel-agency/shared-utils` later).

---

### Task 02-03: Implement Concrete Repositories

**Steps**:

For each service, create repository that extends BaseRepository with custom queries.

**Example: `services/user-service/src/repositories/UserRepository.js`**:
```javascript
const BaseRepository = require('./BaseRepository');
const User = require('../models/User');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return await this.model.findOne({ email: email.toLowerCase() }).lean().exec();
  }

  async findByUsername(username) {
    return await this.model.findOne({ username: username }).lean().exec();
  }

  async findByRole(role) {
    return await this.model.find({ role }).lean().exec();
  }

  // Exclude password from results
  async findAllWithoutPassword(query = {}, options = {}) {
    return await this.model.find(query, '-password', options).exec();
  }

  async findByIdWithoutPassword(id) {
    return await this.model.findById(id, '-password').exec();
  }
}

module.exports = new UserRepository();  // Singleton
```

**Example: `services/package-service/src/repositories/PackageRepository.js`**:
```javascript
const BaseRepository = require('./BaseRepository');
const Package = require('../models/Package');

class PackageRepository extends BaseRepository {
  constructor() {
    super(Package);
  }

  async findByDestination(destination) {
    return await this.model.find({ name: destination }).exec();
  }

  async findByRating(minRating) {
    return await this.model.find({ rating: { $gte: minRating } }).exec();
  }

  async incrementQuantity(id) {
    return await this.model.findByIdAndUpdate(
      id,
      { $inc: { quantity: 1 } },
      { new: true }
    ).exec();
  }

  async decrementQuantity(id) {
    return await this.model.findByIdAndUpdate(
      id,
      { $inc: { quantity: -1 } },
      { new: true }
    ).exec();
  }
}

module.exports = new PackageRepository();
```

**Files**: Create `src/repositories/*.js` in each service.

---

### Task 02-04: Connection Utility Service

**Steps**:

Create `services/user-service/src/utils/database.js` (similar for each service):

```javascript
const mongoose = require('mongoose');

class DatabaseService {
  constructor() {
    this.connection = null;
  }

  async connect(uri, dbName) {
    try {
      this.connection = await mongoose.connect(uri, {
        dbName,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
      });

      console.log(`✓ MongoDB connected: ${dbName} at ${uri}`);
      return this.connection;
    } catch (error) {
      console.error('✗ MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('✓ MongoDB disconnected');
    }
  }

  async ping() {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    await this.connection.db.admin().ping();
    return true;
  }
}

module.exports = new DatabaseService();  // Singleton
```

**In `src/app.js`**:
```javascript
const db = require('./utils/database');
const config = require('@travel-agency/shared-config').get(process.env.SERVICE_NAME);

db.connect(config.mongodb.url, config.mongodb.database)
  .then(() => console.log('Database ready'))
  .catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await db.disconnect();
  process.exit(0);
});
```

**Files**: Each service gets `src/utils/database.js` and updates `src/app.js`.

---

### Task 02-05: Database Initialization Scripts

**Steps**:

Create scripts to create indexes and seed sample data.

1. **Index Creation**: Mongoose auto-creates indexes on startup. But can also create manually:

`services/user-service/src/scripts/create-indexes.js`:
```javascript
const User = require('../models/User');

async function createIndexes() {
  try {
    // Mongoose auto-creates indexes defined in schema
    // But ensure they're built
    await User.init();
    console.log('✓ User indexes created');
    process.exit(0);
  } catch (error) {
    console.error('✗ Index creation failed:', error);
    process.exit(1);
  }
}

createIndexes();
```

2. **Seed Data** (optional but nice for dev):

`services/package-service/src/scripts/seed.js`:
```javascript
const Package = require('../models/Package');

async function seed() {
  const packages = [
    {
      name: 'Paris Getaway',
      description: '7 days in Paris with hotel and tours',
      price: 1999,
      quantity: 50,
      url: 'https://example.com/paris',
      rating: 4.5
    },
    // Add more...
  ];

  for (const pkg of packages) {
    const existing = await Package.findOne({ name: pkg.name });
    if (!existing) {
      await Package.create(pkg);
      console.log(`✓ Created package: ${pkg.name}`);
    } else {
      console.log(`- Skipped (exists): ${pkg.name}`);
    }
  }

  process.exit(0);
}

seed().catch(console.error);
```

3. **K8s Init Container** (to run seeds on pod start):

In `k8s/services/package-service/patches/init-container.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: package
spec:
  template:
    spec:
      initContainers:
        - name: init-db
          image: travel-agency/package-service:latest
          command: ['node', 'src/scripts/seed.js']
          envFrom:
            - configMapRef:
                name: package-config
            - secretRef:
                name: package-secrets
```

---

### Task 02-06: Monolith Data Migration Script

**AI Context**: One-time script to copy data from monolith collections to new service databases.

**Steps**:

Create `scripts/migrate-data.js` at root:

```javascript
const { MongoClient } = require('mongodb');
const config = require('./migration-config.json');  // Source/target DB configs

async function migrate() {
  const sourceClient = await MongoClient.connect(config.source.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const sourceDb = sourceClient.db(config.source.dbName);

  // User -> user-service DB
  const users = await sourceDb.collection('users').find({}).toArray();
  const userServiceClient = await MongoClient.connect(config.target.user.url);
  const userDb = userServiceClient.db(config.target.user.dbName);
  await userDb.collection('users').insertMany(users);
  console.log(`✓ Migrated ${users.length} users`);
  await userServiceClient.close();

  // Package -> package-service DB
  const packages = await sourceDb.collection('packages').find({}).toArray();
  // ... similar

  // Order -> order-service DB
  // ...

  await sourceClient.close();
  console.log('✓ Migration complete');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('✗ Migration failed:', error);
  process.exit(1);
});
```

**Config file**: `migration-config.json`:
```json
{
  "source": {
    "url": "mongodb://localhost:27017",
    "dbName": "travel_agency"
  },
  "target": {
    "user": {
      "url": "mongodb://localhost:27017",
      "dbName": "user_service_db"
    },
    "package": {
      "url": "mongodb://localhost:27018",
      "dbName": "package_service_db"
    }
    // ...
  }
}
```

**Run**: `node scripts/migrate-data.js` before deploying services.

**Note**: This is one-time. After cutover, monolith is decommissioned.

---

### Task 02-07: Testing - Unit & Integration

**Steps**:

1. **Unit tests** (`services/user-service/tests/unit/repository.test.js`):
```javascript
const UserRepository = require('../../src/repositories/UserRepository');
const User = require('../../src/models/User');

// Mock the User model
jest.mock('../../src/models/User');

describe('UserRepository', () => {
  it('should find user by email', async () => {
    const user = { _id: '123', email: 'test@example.com' };
    User.findOne = jest.fn().mockResolvedValue(user);

    const result = await UserRepository.findByEmail('test@example.com');

    expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    expect(result).toEqual(user);
  });
});
```

2. **Integration tests** (`services/user-service/tests/integration/api.test.js`):
```javascript
const request = require('supertest');
const app = require('../../src/app');

describe('User API', () => {
  it('POST /sign-up creates user', async () => {
    const response = await request(app)
      .post('/sign-up')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPass: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('created successfully');
  });
});
```

3. **Jest config** (`services/user-service/jest.config.js`):
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
};
```

4. **Test setup** (`services/user-service/tests/setup.js`):
```javascript
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test' });
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
```

**Files**: Each service gets:
- `tests/unit/` directory with unit tests for repository and service
- `tests/integration/` directory with API tests
- `tests/fixtures/` with sample data
- `jest.config.js`
- `tests/setup.js`

---

## Acceptance Criteria

- [ ] All 6 schemas defined with validation
- [ ] BaseRepository implemented with common CRUD
- [ ] Concrete repositories extend BaseRepository with custom queries
- [ ] Database connection utility works and handles reconnection
- [ ] Service starts, connects to DB, runs migrations (indexes)
- [ ] Unit tests for repositories pass (with mocks)
- [ ] Integration tests for API endpoints pass (with test DB)
- [ ] Coverage >= 70%
- [ ] Monolith data migration script created and tested
- [ ] All services can connect to their respective MongoDB instances in K8s

---

## Files to Create

**Shared**:
- `shared/errors/AppError.js` (from Plan 01)
- `shared/config/index.js` (from Plan 01)

**Per Service**:
- `src/models/{Entity}.js`
- `src/repositories/BaseRepository.js`
- `src/repositories/{Entity}Repository.js`
- `src/utils/database.js`
- `src/app.js` (updated with DB connection)
- `tests/unit/{entity}.repository.test.js`
- `tests/integration/api.test.js`
- `tests/fixtures/{entity}.js`
- `jest.config.js`
- `tests/setup.js`
- `src/scripts/create-indexes.js`
- `src/scripts/seed.js` (optional)

**Root**:
- `scripts/migrate-data.js`
- `migration-config.json`

---

## Next Steps After Completion

All services have:
- Defined data models
- Repository layer for testable data access
- Database connectivity
- Indexes for performance
- Tests covering data layer

**Ready for**: Plan 03 - Extract User Service (first actual service implementation with routes, controllers, services)

---

## Notes

- **Repository Pattern**: Provides abstraction. If switching DB later, only BaseRepository and concrete repositories need changes.
- **DI**: Repositories are singleton instances imported by services. For better testability, consider constructor injection (pass repository as argument).
- **Indexes**: Add compound indexes for common query patterns (e.g., `{ user: 1, createdAt: -1 }` for user-specific feeds).
- **Denormalization**: Some duplication across services is okay for performance (e.g., Order stores userName instead of just userId). Use RabbitMQ events to keep denormalized data in sync.
- **Validation**: Mongoose handles basic validation. Add Joi for request body validation in routes.
- **Testing**: Use `mongodb-memory-server` for true in-memory MongoDB, or mock with Jest.

---

**Auto-Mode**: This plan can be automated but requires review of schema decisions. Safe to generate files automatically once schemas are finalized. Assumes MongoDB pods are running from Plan 01.
