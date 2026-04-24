if (!process.env.PORT) process.env.PORT = '3002'
if (!process.env.SERVICE_NAME) process.env.SERVICE_NAME = 'package-service'
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test'
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-package-service'
}
