const jwt = require('jsonwebtoken')
const { AppError } = require('@travel-agency/shared-errors')

/**
 * Authentication utility for JWT token management
 */
class AuthService {
  constructor() {
    const config = require('@travel-agency/shared-config').get('user-service')
    this.secret = config.jwt?.secret || process.env.JWT_SECRET
    this.expiresIn = config.jwt?.expiresIn || '24h'
    this.refreshExpiresIn = config.jwt?.refreshExpiresIn || '7d'

    if (!this.secret) {
      throw new AppError('JWT_SECRET is required', 500)
    }
  }

  /**
   * Generate JWT access token
   * @param {string} userId - User's MongoDB ObjectId
   * @param {string} email - User's email
   * @param {string} role - User's role (Customer, Admin, Agent)
   * @returns {string} Signed JWT
   */
  generateToken(userId, email, role) {
    const payload = {
      userId,
      email,
      role
    }

    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn })
  }

  /**
   * Generate refresh token (long-lived)
   * @param {string} userId
   * @returns {string} Signed refresh token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh'
    }

    return jwt.sign(payload, this.secret, { expiresIn: this.refreshExpiresIn })
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT to verify
   * @returns {Object} Decoded payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret)
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401)
      }
      throw new AppError('Invalid token', 401)
    }
  }

  /**
   * Decode token without verification (for checking type)
   * Useful for refresh token validation
   * @param {string} token
   * @returns {Object|null}
   */
  decodeToken(token) {
    try {
      return jwt.decode(token)
    } catch {
      return null
    }
  }
}

// Singleton instance
let authServiceInstance = null

function getAuthService() {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService()
  }
  return authServiceInstance
}

module.exports = {
  AuthService,
  getAuthService
}
