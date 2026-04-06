const { getAuthService } = require('../utils/auth')
const { AppError } = require('@travel-agency/shared-errors')

/**
 * Middleware to authenticate JWT token
 * Expects Authorization header: Bearer <token>
 */
async function authenticateJWT(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401)
    }

    const token = authHeader.split(' ')[1]

    // Verify token
    const authService = getAuthService()
    const decoded = authService.verifyToken(token)

    // Attach user info to request
    req.userId = decoded.userId
    req.userRole = decoded.role
    req.userEmail = decoded.email

    next()
  } catch (error) {
    // AppError already has proper status and message
    if (error instanceof AppError) {
      next(error)
    } else {
      next(new AppError('Authentication failed', 401))
    }
  }
}

/**
 * Middleware to authorize based on role
 * @param {...string} allowedRoles - Roles that can access
 */
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return next(new AppError('No user role in request', 401))
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new AppError('Insufficient permissions', 403))
    }

    next()
  }
}

module.exports = {
  authenticateJWT,
  authorizeRole
}
