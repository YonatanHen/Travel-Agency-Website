---
name: error-handling
description: Standardize error handling across all microservices. Implement centralized error middleware, consistent error response format, proper logging with correlation IDs, and graceful shutdown.
---

All services must implement this error handling pattern.

## Error Response Format

Always return JSON with consistent structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Human readable message",
  "details": { ... }  // optional, only in development
}
```

Or simpler (without success wrapper):
```json
{
  "error": "Invalid input",
  "field": "email",
  "message": "Email is required"
}
```

Pick one format and use consistently across all services.

## Error Middleware

At the end of your Express route definitions:

```javascript
// Error handler - must be after all routes
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  // Log with context
  console.error(`${req.method} ${req.path}`, {
    service: 'user-service',
    correlationId: req.correlationId,
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })

  const response = {
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  }

  res.status(status).json(response)
})
```

## Throwing Errors in Routes

Use standard HTTP error classes or create custom ones:

```javascript
const createError = require('http-errors')

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (!user) {
      throw createError(401, 'Invalid credentials')
    }
    // ... rest
  } catch (error) {
    next(error) // Passes to error middleware
  }
})
```

Common status codes:
- 400 Bad Request - validation failed
- 401 Unauthorized - missing/invalid credentials
- 403 Forbidden - authenticated but not allowed
- 404 Not Found - resource doesn't exist
- 409 Conflict - duplicate resource
- 500 Internal Server Error - unexpected server error
- 503 Service Unavailable - downstream service unavailable

## Validation Errors

Use express-validator and return 400 with details:

When validation fails in route middleware:
```javascript
router.post('/sign-up', [
  check('email').isEmail(),
  check('password').isLength({ min: 6 })
], async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    })
  }
  // ... rest
})
```

## Service-to-Service Call Errors

When calling another service with axios:

```javascript
try {
  const response = await axios.get(`${PACKAGE_SERVICE_URL}/packages`, {
    params: { destination },
    timeout: 5000
  })
  return response.data
} catch (error) {
  if (error.response) {
    // Service responded with error status (4xx, 5xx)
    console.error('Package service error:', error.response.status)
    throw createError(502, 'Package service error')
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    // Service unreachable
    console.error('Package service unavailable:', error.message)
    throw createError(503, 'Package service unavailable')
  } else {
    // Other axios error
    throw error
  }
}
```

## Graceful Shutdown

Handle SIGTERM and SIGINT:

```javascript
const server = app.listen(PORT, () => {
  console.log(`${serviceName} listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received - starting graceful shutdown')
  server.close(async () => {
    console.log('HTTP server closed')
    // Close DB connections if needed
    await mongoose.connection.close()
    console.log('Database connection closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received')
  process.exit(0)
})
```

Set timeout for server.close to avoid hanging:
```javascript
const KILL_TIMEOUT = 10000
server.close(() => {
  process.exit(0)
})
setTimeout(() => {
  console.error('Could not close connections in time, forcefully shutting down')
  process.exit(1)
}, KILL_TIMEOUT)
```

## Logging Errors

Always log errors with correlation ID (if present from gateway):
```javascript
console.error('Operation failed', {
  service: 'user-service',
  correlationId: req.correlationId || 'none',
  method: req.method,
  path: req.path,
  error: err.message,
  ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
})
```

Use structured logging libraries (pino, winston) for JSON output in production.

## Uncaught Exceptions

Add global handler (last resort):
```javascript
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1) // Exit immediately - state may be corrupt
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
```

## Do NOT

- Swallow errors (empty catch blocks)
- Return stack traces in production responses
- Use console.error without context (add method, path, correlationId)
- Continue processing after critical errors
- Expose internal error details to clients in production
