const request = require('supertest')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { mongoose } = require('@travel-agency/shared-utils')

const app = require('../../src/app')
const Package = require('../../src/models/Package')

let mongod
jest.setTimeout(180000)

function createToken(role = 'Customer') {
  return jwt.sign(
    { userId: '507f1f77bcf86cd799439011', email: 'test@example.com', role },
    process.env.JWT_SECRET
  )
}

describe('Package Routes Integration Tests', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName: 'package_service_test_db' })
  })

  afterEach(async () => {
    await Package.deleteMany({})
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongod.stop()
  })

  it('GET /health returns service health', async () => {
    const response = await request(app).get('/health').expect(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.service).toBe('package-service')
    expect(response.body.database).toBe('connected')
  })

  it('GET /api/packages lists packages publicly', async () => {
    await Package.create({
      name: 'Rome Adventure',
      description: 'Historic city package',
      price: 900,
      quantity: 4,
      destination: 'Rome',
      duration: 3
    })

    const response = await request(app).get('/api/packages').expect(200)

    expect(response.body.packages).toHaveLength(1)
    expect(response.body.total).toBe(1)
  })

  it('GET /api/packages/:id returns a package', async () => {
    const pkg = await Package.create({
      name: 'Tokyo Nights',
      description: 'City lights tour',
      price: 1500,
      quantity: 5,
      destination: 'Tokyo',
      duration: 6
    })

    const response = await request(app).get(`/api/packages/${pkg._id}`).expect(200)
    expect(response.body.name).toBe('Tokyo Nights')
  })

  it('POST /api/packages returns 401 without token', async () => {
    await request(app)
      .post('/api/packages')
      .send({
        name: 'Berlin City Break',
        description: 'Modern and historic blend',
        destination: 'Berlin',
        price: 800,
        duration: 4
      })
      .expect(401)
  })

  it('POST /api/packages returns 403 for non-admin token', async () => {
    const userToken = createToken('Customer')

    await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Barcelona Escape',
        description: 'Beach and architecture',
        destination: 'Barcelona',
        price: 950,
        duration: 5
      })
      .expect(403)
  })

  it('POST /api/packages creates package for admin', async () => {
    const adminToken = createToken('Admin')

    const response = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lisbon Explorer',
        description: 'Culture and food',
        destination: 'Lisbon',
        price: 1100,
        duration: 5,
        quantity: 7
      })
      .expect(201)

    expect(response.body._id).toBeDefined()
    expect(response.body.name).toBe('Lisbon Explorer')
  })

  it('PUT /api/packages/:id updates package for admin', async () => {
    const adminToken = createToken('Admin')
    const pkg = await Package.create({
      name: 'Vienna Classic',
      description: 'Music and museums',
      price: 1000,
      quantity: 2,
      destination: 'Vienna',
      duration: 4
    })

    const response = await request(app)
      .put(`/api/packages/${pkg._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 1200 })
      .expect(200)

    expect(response.body.price).toBe(1200)
  })

  it('DELETE /api/packages/:id soft deletes package', async () => {
    const adminToken = createToken('Admin')
    const pkg = await Package.create({
      name: 'Prague Weekend',
      description: 'Old town experience',
      price: 700,
      quantity: 3,
      destination: 'Prague',
      duration: 3
    })

    const response = await request(app)
      .delete(`/api/packages/${pkg._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    expect(response.body.isActive).toBe(false)
  })

  it('POST /api/packages/:id/rating adds rating for authenticated user', async () => {
    const userToken = createToken('Customer')
    const pkg = await Package.create({
      name: 'Dubai Luxury',
      description: 'Premium desert and city trip',
      price: 2200,
      quantity: 6,
      destination: 'Dubai',
      duration: 5
    })

    const response = await request(app)
      .post(`/api/packages/${pkg._id}/rating`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 5 })
      .expect(200)

    expect(response.body.reviewCount).toBe(1)
    expect(response.body.rating).toBe(5)
  })
})
