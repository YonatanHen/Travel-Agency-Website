const jwt = require('jsonwebtoken')
const Config = require('@travel-agency/shared-config')
const { AppError } = require('@travel-agency/shared-errors')

const config = Config.get('package-service')
const jwtSecret = config.jwt?.secret || process.env.JWT_SECRET

function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401)
    }

    if (!jwtSecret) {
      throw new AppError('JWT secret is not configured', 500)
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, jwtSecret)

    req.userId = decoded.userId
    req.userRole = decoded.role
    req.userEmail = decoded.email

    next()
  } catch (error) {
    if (error instanceof AppError) {
      return next(error)
    }
    return next(new AppError('Authentication failed', 401))
  }
}

function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return next(new AppError('No user role in request', 401))
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new AppError('Insufficient permissions', 403))
    }

    return next()
  }
}

module.exports = {
  authenticateJWT,
  authorizeRole
}
