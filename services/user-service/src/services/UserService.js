const bcrypt = require('bcryptjs')
const Joi = require('joi')
const { getAuthService } = require('../utils/auth')
const { ConflictError, BadRequestError, UnauthorizedError, NotFoundError } = require('@travel-agency/shared-errors')

/**
 * UserService - Business logic for user management and authentication
 *
 * Implements SOLID principles:
 * - Single Responsibility: Handles user-related operations only
 * - Dependency Inversion: Depends on IUserRepository abstraction via constructor injection
 * - Testability: Repository is mockable, bcrypt can be stubbed
 */
class UserService {
  /**
   * @param {IUserRepository} userRepository
   */
  constructor(userRepository) {
    this.userRepository = userRepository
    this.authService = getAuthService()
  }

  /**
   * Register a new user
   * @param {Object} data - { username, email, password, confirmPass, role? }
   * @returns {Promise<Object>} Created user (without password)
   */
  async registerUser(data) {
    // 1. Validate input
    await this.validateRegistration(data)

    // 2. Check for existing username or email
    const existingByUsername = await this.userRepository.findByUsername(data.username)
    if (existingByUsername) {
      throw ConflictError('Username already exists')
    }

    const existingByEmail = await this.userRepository.findByEmail(data.email)
    if (existingByEmail) {
      throw ConflictError('Email already registered')
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // 4. Create user entity (password only field from input)
    const userData = {
      username: data.username,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role || 'Customer' // Default role
    }

    // 5. Save via repository
    const savedUser = await this.userRepository.save(userData)

    // 6. Return user without password (repository returns lean object, but ensure)
    return this.userRepository.findById(savedUser._id)
  }

  /**
   * Authenticate user and generate tokens
   * @param {string} identifier - username or email
   * @param {string} password - plain password
   * @returns {Promise<Object>} { token, refreshToken, user: { id, username, email, role } }
   */
  async loginUser(identifier, password) {
    // 1. Validate input
    if (!identifier || !password) {
      throw BadRequestError('Username/email and password are required')
    }

    // 2. Find user by username OR email (exclude password from result)
    const user = await this.userRepository.findByUsernameOrEmail(identifier)
    if (!user) {
      throw UnauthorizedError('Invalid credentials')
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      throw UnauthorizedError('Invalid credentials')
    }

    // 4. Generate tokens
    const token = this.authService.generateToken(user._id, user.email, user.role)
    const refreshToken = this.authService.generateRefreshToken(user._id)

    // 5. Return user info + tokens (no password)
    const { password: _, ...userWithoutPassword } = user // Remove password just in case

    return {
      token,
      refreshToken,
      user: userWithoutPassword
    }
  }

  /**
   * Get user by ID (for authenticated requests)
   * @param {string} userId
   * @returns {Promise<Object>} User without password
   */
  async getUserById(userId) {
    if (!userId) {
      throw new BadRequestError('User ID is required')
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw NotFoundError('User not found')
    }

    return user
  }

  /**
   * Validate registration data using Joi
   * @param {Object} data
   * @throws {BadRequestError}
   */
  async validateRegistration(data) {
    const schema = Joi.object({
      username: Joi.string()
        .min(3)
        .max(30)
        .required()
        .messages({
          'string.min': 'Username must be at least 3 characters',
          'string.max': 'Username cannot exceed 30 characters',
          'any.required': 'Username is required'
        }),
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Invalid email address',
          'any.required': 'Email is required'
        }),
      password: Joi.string()
        .min(6)
        .required()
        .messages({
          'string.min': 'Password must be at least 6 characters',
          'any.required': 'Password is required'
        }),
      confirmPass: Joi.any()
        .valid(Joi.ref('password'))
        .required()
        .messages({
          'any.only': 'Passwords do not match',
          'any.required': 'Password confirmation is required'
        })
    })

    const { error } = schema.validate(data)
    if (error) {
      throw BadRequestError(error.details[0].message)
    }
  }
}

module.exports = UserService
