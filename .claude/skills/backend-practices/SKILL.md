---
name: backend-practices
description: Standard patterns for Express.js microservices: service structure, middleware, authentication, request validation, service-to-service communication, and API design. Follow these conventions for consistent, production-ready services.
---

## Service Structure

Every microservice follows this layout:

```
services/<service-name>/
├── src/
│   ├── index.js          # Express app setup, middleware registration, error handler
│   ├── routes/           # Route definitions (auth.js, packages.js, etc.)
│   ├── middleware/       # Custom middleware (auth.js, validate.js, rateLimit.js)
│   ├── models/           # Mongoose schemas and connection module
│   └── utils/            # Helper functions (validation, formatting, etc.)
├── tests/integration/    # Integration tests mirroring routes
├── tests/unit/           # Unit tests for utils, middleware
├── package.json
├── Dockerfile
├── .env.example
└── README.md
```

## Express App Setup (index.js)

```javascript
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { connectDB } = require('./models/connection')
const authMiddleware = require('./middleware/auth')
const routes = require('./routes/auth') // or multiple routes

const app = express()
const PORT = process.env.PORT || 3001
const SERVICE_NAME = 'user-service'

// Middleware - Order matters!
app.use(helmet())              // Security headers
app.use(cors())                // CORS
app.use(express.json())       // Body parser
app.use(morgan('combined'))   // Request logging (or 'json' for structured)

// Correlation ID from gateway (set by gateway, just use if present)
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || null
  next()
})

// Health check (before routes)
app.get('/health', (req, res) => {
  const health = {
    status: 'UP',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }
  res.status(200).json(health)
})

// Routes
app.use('/login', routes)
app.use('/sign-up', routes)
// More routes...

// Error handler (after all routes)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  console.error(`${req.method} ${req.path}`, {
    service: SERVICE_NAME,
    correlationId: req.correlationId,
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { details: err.details })
  })
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`)
})

module.exports = app
```

## Route Pattern

Keep routes thin; delegate to controllers/services:

```javascript
// services/user-service/src/routes/auth.js
const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// POST /sign-up
router.post('/sign-up', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('username').notEmpty().trim(),
  body('role').optional().isIn(['Customer', 'Admin', 'Agent'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { email, password, username, role } = req.body

    // Check if user exists
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ error: 'User already exists' })
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10)

    // Create user
    const user = new User({
      email,
      password: hashed,
      username,
      role: role || 'Customer'
    })
    await user.save()

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'User signed up successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      token
    })
  } catch (error) {
    next(error)
  }
})

// POST /login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  // Implementation...
})

module.exports = router
```

## Middleware Patterns

**Authentication (JWT):**

```javascript
// services/user-service/src/middleware/auth.js
const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded // { userId, role }
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

**Role-based Authorization:**

```javascript
// services/user-service/src/middleware/requireRole.js
module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

// Usage: router.post('/admin', auth, requireRole('Admin'), handler)
```

**Rate Limiting:**

```javascript
// services/<service>/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit')

const createRateLimit = (windowMs, maxRequests, message) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false
  })
}

module.exports = { createRateLimit }

// Usage in index.js:
const { createRateLimit } = require('./middleware/rateLimit')
app.use('/login', createRateLimit(15 * 60 * 1000, 5, 'Too many login attempts, please try again later'))
```

## Service-to-Service Communication

Use axios with timeout and error handling:

```javascript
const axios = require('axios')

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001'

class UserServiceClient {
  async getUserById(userId) {
    try {
      const response = await axios.get(`${USER_SERVICE_URL}/users/${userId}`, {
        timeout: 5000,  // 5 seconds
        headers: {
          'Accept': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      if (error.response) {
        // Service returned 4xx/5xx
        console.error('User service error:', error.response.status)
        throw new Error(`User service returned ${error.response.status}`)
      } else if (error.code === 'ECONNREFUSED') {
        console.error('User service connection refused')
        throw new Error('User service unavailable')
      } else if (error.code === 'ECONNABORTED') {
        console.error('User service timeout')
        throw new Error('User service timeout')
      } else {
        throw error
      }
    }
  }
}

module.exports = new UserServiceClient()
```

**Retry Logic** (install `axios-retry`):

```javascript
const axios = require('axios')
const axiosRetry = require('axios-retry')

const client = axios.create({ baseURL: USER_SERVICE_URL })
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status >= 500
  }
})
```

## Request Validation

Use `express-validator` for all incoming data:

```javascript
const { body, query, param, validationResult } = require('express-validator')

// POST route
router.post('/packages', [
  body('name').notEmpty().trim().escape(),
  body('price').isFloat({ min: 0 }),
  body('destination').notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601().custom((value, { req }) => {
    if (new Date(value) < new Date(req.body.startDate)) {
      throw new Error('endDate must be after startDate')
    }
    return true
  })
], async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    })
  }
  // Proceed with valid data
})

// GET route with query params
router.get('/packages', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('destination').optional().isString()
], async (req, res, next) => {
  // Validated query params available in req.query
})
```

## Port Allocation

Fixed ports per service (do not change):
- Gateway: 3000
- User Service: 3001
- Package Service: 3002
- Order Service: 3003
- Customer Service: 3004
- Communication Service: 3005

Set in service `.env.example`: `PORT=3001` (etc.)

## Persistent vs Stateless

Services should be **stateless** - no in-memory session storage. All state in database. This allows horizontal scaling.

If you need session-like behavior, use:
- JWT tokens (already used)
- Redis for caching/sessions (optional)
- Database for persistence

## API Design Principles

During extraction (Baby Steps 1-7):
- Keep original endpoint paths exactly
- Do NOT change request/response format

During API standardization (Baby Step 8, optional):
- Use RESTful conventions: resources as nouns, HTTP verbs
- `/api/v1/` prefix if versioning
- Consistency across services

Example good patterns:
- `GET /packages` - list
- `GET /packages/:id` - get one
- `POST /packages` - create
- `PUT /packages/:id` - update
- `DELETE /packages/:id` - delete
- `GET /packages?destination=Paris&page=1` - filtered list

## Configuration Management

All configuration via environment variables:
```javascript
const config = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI,
  databaseName: process.env.DATABASE_NAME,
  jwtSecret: process.env.JWT_SECRET,
  userServiceUrl: process.env.USER_SERVICE_URL
}
```

Validate required vars on startup:

```javascript
const required = ['MONGODB_URI', 'DATABASE_NAME', 'JWT_SECRET']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}
```

## Logging (Basic)

For portfolio, use structured logger like pino or winston. Basic version:

```javascript
const pino = require('pino')
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
})

// Usage:
logger.info('User logged in', {
  service: 'user-service',
  userId: user._id,
  correlationId: req.correlationId
})
```

## Do NOT

- Mix route handlers with business logic - extract to service layer if complex
- Use synchronous file operations in request path
- Store state in module-level variables (they persist across requests)
- Block event loop with synchronous code
- Use \`any\` in TypeScript (if you add TS later)
- Expose internal implementation details in error messages
- Skip input validation
