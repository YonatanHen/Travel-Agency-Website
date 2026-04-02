---
name: unit-testing
description: Write comprehensive unit and integration tests for Express microservices using Jest and Supertest. Mock dependencies, clean test database, achieve 70%+ coverage, test error cases. Integration tests hit real endpoints with test DB.
---

This project uses **Jest** with **Supertest** for backend testing.

## Test Structure

Each service:
```
services/<service-name>/
├── tests/
│   ├── unit/           # Test individual functions/middleware
│   └── integration/   # Test full endpoints with test DB
│       └── <route>.test.js
```

## Integration Test Pattern (Most Important)

Test full HTTP endpoints against your Express app with a real (test) database:

```javascript
const request = require('supertest')
const app = require('../../src/index')
const { MongoClient } = require('mongodb')

describe('User Service - Auth', () => {
  let client, db

  beforeAll(async () => {
    // Connect to test database
    client = await MongoClient.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      { useUnifiedTopology: true }
    )
    db = client.db(process.env.DATABASE_NAME + '_test')
    global.db = db // Make available to routes
  })

  beforeEach(async () => {
    // Clear collections before each test
    await db.collection('users').deleteMany({})
  })

  afterAll(async () => {
    await client.close()
  })

  test('POST /sign-up - creates new user with valid data', async () => {
    const response = await request(app)
      .post('/sign-up')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPass: 'password123',
        role: 'Customer'
      })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('message', 'User signed up successfully')
    expect(response.body).toHaveProperty('user')
  })

  test('POST /sign-up - returns 400 if email invalid', async () => {
    const response = await request(app)
      .post('/sign-up')
      .send({
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('error')
  })

  test('POST /login - rejects wrong password', async () => {
    // Create user first with known password
    const bcrypt = require('bcrypt')
    const hashed = await bcrypt.hash('correctpassword', 10)
    await db.collection('users').insertOne({
      username: 'testuser',
      email: 'test@example.com',
      password: hashed,
      role: 'Customer'
    })

    const response = await request(app)
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Invalid credentials')
  })
})
```

## Unit Test Pattern (for pure functions)

Test standalone functions, middleware, utilities:

```javascript
const { validateEmail } = require('../../src/utils/validation')

describe('validateEmail', () => {
  test('returns true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  test('returns false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false)
  })
})
```

## Mocking External Services

When service calls another service (axios), mock it:

```javascript
jest.mock('axios')
const axios = require('axios')

test('POST /add-order - calls package service to validate', async () => {
  axios.get.mockResolvedValue({
    data: [{ destination: 'Paris', quantity: 10 }]
  })

  const response = await request(app)
    .post('/add-order')
    .send({ Destination: 'Paris', Quantity: 2, ... })

  expect(axios.get).toHaveBeenCalledWith(
    expect.stringContaining('http://package-service:3002/packages')
  )
  expect(response.status).toBe(200)
})
```

Or use `nock` library for HTTP mocking:
```javascript
const nock = require('nock')

beforeEach(() => {
  nock('http://package-service:3002')
    .get('/packages')
    .query({ destination: 'Paris' })
    .reply(200, [{ destination: 'Paris', quantity: 10 }])
})
```

## Test Database Setup

**Never** use the production database. Use:

```javascript
const testDB = process.env.DATABASE_NAME + '_test'
// e.g., travel_agency_users_test
```

In `.env.test` or test script:
```bash
DATABASE_NAME=travel_agency_users_test
mongodb://localhost:27017/${DATABASE_NAME}
```

Create a `test/test.env` file for automated testing (already exists in project).

## package.json Test Scripts

Each service:
```json
{
  "scripts": {
    "test": "jest --detectOpenHandles --forceExit",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

\`--detectOpenHandles\` and \`--forceExit\` ensure tests terminate even if DB connections linger.

## Coverage

Aim for 70%+ coverage. Generate report:
```bash
npm run test:coverage
```

Upload to Codecov:
```yaml
- uses: codecov/codecov-action@v4
  with:
    file: coverage/coverage-final.json
```

## Testing Service-to-Service Communication

**Integration approach**: Mock external services with `nock` so tests don't depend on other services being running.

**Unit approach**: Mock axios directly with `jest.mock('axios')`.

Always test:
- Success path (other service returns data)
- Other service returns error (4xx, 5xx)
- Other service unreachable (timeout, connection refused)
- Timeouts

## Test Independent Principles

- Tests should run in any order
- \`beforeEach\` must clean state (deleteMany or drop collections)
- Don't rely on data from previous test
- Each test creates its own test data
- Clean up in \`afterAll\` (close DB connection)

## Naming Conventions

Test files: \`<feature>.test.js\` or \`<route>.test.js\`
Describe blocks: Group by route or feature
Test names: "should [expected behavior] when [condition]"
```javascript
test('should return 404 when user not found', async () => {})
```

## Do NOT

- Skip tests for "simple" code
- Write tests that depend on execution order
- Use production database in tests
- Commit without running tests locally first
- Leave \`console.log\` statements in tests