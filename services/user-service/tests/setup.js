// Set test environment variables before any tests run
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production'
}

if (!process.env.PORT) {
  process.env.PORT = '3002'
}

if (!process.env.SERVICE_NAME) {
  process.env.SERVICE_NAME = 'user-service'
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

// MONGODB_URL is provided by @shelf/jest-mongodb preset
