const request = require('supertest')
const app = require('../../src/app')
const User = require('../../src/models/User')
const { mongoose } = require('@travel-agency/shared-utils')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongod

// Use in-memory MongoDB for integration tests (more reliable than preset)
beforeAll(async () => {
  // Start in-memory MongoDB
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()

  // Connect mongoose to in-memory DB
  await mongoose.connect(uri)
  console.log('[integration tests] Connected to in-memory MongoDB')

  // Ensure indexes
  await User.init()
  console.log('[integration tests] Indexes ensured')
})

// Cleanup database after each test to ensure test isolation
afterEach(async () => {
  await User.deleteMany({})
  console.log('[integration tests] User collection cleared')
})

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
  console.log('[integration tests] Cleanup complete')
})

describe('Authentication API Integration Tests', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    confirmPass: 'password123'
  }

  let authToken

  describe('POST /api/auth/sign-up', () => {
    it('should register a new user with status 201', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up')
        .send(testUser)
        .expect(201)

      expect(response.body).toHaveProperty('_id')
      expect(response.body.username).toBe(testUser.username)
      expect(response.body.email).toBe(testUser.email)
      expect(response.body.role).toBe('Customer')
      expect(response.body.password).toBeUndefined()
    })

    it('should reject duplicate username with 409', async () => {
      await request(app)
        .post('/api/auth/sign-up')
        .send(testUser)
        .expect(201)

      const response = await request(app)
        .post('/api/auth/sign-up')
        .send(testUser)
        .expect(409)

      expect(response.body.error.message).toMatch(/already exists/i)
    })

    it('should reject invalid email with 400', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up')
        .send({
          username: 'validuser',
          email: 'invalidemail',
          password: 'password123',
          confirmPass: 'password123'
        })
        .expect(400)

      expect(response.body.error.message).toMatch(/invalid email/i)
    })

    it('should reject mismatched passwords with 400', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up')
        .send({
          username: 'validuser',
          email: 'valid@example.com',
          password: 'password123',
          confirmPass: 'different'
        })
        .expect(400)

      expect(response.body.error.message).toMatch(/do not match/i)
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Ensure user exists before each login test
      await request(app)
        .post('/api/auth/sign-up')
        .send(testUser)
        .expect(201)
    })

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        })
        .expect(200)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('refreshToken')
      expect(response.body.user).toHaveProperty('_id')
      expect(response.body.user.username).toBe(testUser.username)
      expect(response.body.user.email).toBe(testUser.email)
      expect(response.body.user.password).toBeUndefined()

      // Save token for protected route tests
      authToken = response.body.token
    })

    it('should login with email as username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.email,
          password: testUser.password
        })
        .expect(200)

      expect(response.body.token).toBeDefined()
    })

    it('should reject with wrong password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        })
        .expect(401)
    })

    it('should reject with non-existent user', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password'
        })
        .expect(401)
    })

    it('should reject missing credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400)
    })
  })

  describe('GET /api/auth/me (protected)', () => {
    let token

    beforeEach(async () => {
      // Ensure user exists and get a valid token before each test
      await request(app)
        .post('/api/auth/sign-up')
        .send(testUser)
        .expect(201)

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        })
        .expect(200)

      token = response.body.token
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body).toHaveProperty('_id')
      expect(response.body.username).toBe(testUser.username)
      expect(response.body.email).toBe(testUser.email)
      expect(response.body.password).toBeUndefined()
    })

    it('should reject without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401)
    })

    it('should reject with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })

    it('should reject with malformed authorization header', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'invalid')
        .expect(401)
    })
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body.status).toBe('ok')
      expect(response.body.service).toBe('user-service')
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.database).toBe('connected')
    })
  })
})
