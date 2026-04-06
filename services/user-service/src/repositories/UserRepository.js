const BaseRepository = require('@travel-agency/shared-repositories')
const User = require('../models/User')

/**
 * UserRepository handles all data access operations for User entities.
 * Extends BaseRepository with user-specific queries.
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(User)
  }

  /**
   * Find user by email (case-insensitive) - excludes password
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    if (!email) return null
    return await this.Model.findOne({ email: email.toLowerCase() }).select('-password').lean()
  }

  /**
   * Find user by username - excludes password
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  async findByUsername(username) {
    if (!username) return null
    return await this.Model.findOne({ username: username.toLowerCase() }).select('-password').lean()
  }

  /**
   * Find user by username OR email (for login) - includes password for bcrypt verification
   * @param {string} identifier - username or email
   * @returns {Promise<Object|null>}
   */
  async findByUsernameOrEmail(identifier) {
    if (!identifier) return null
    const lower = identifier.toLowerCase()
    return await this.Model.findOne({
      $or: [
        { username: lower },
        { email: lower }
      ]
    }).lean()
    // Password is included for authentication (bcrypt comparison).
    // Service layer ensures password is never returned to clients.
  }

  /**
   * Find users by role
   * @param {string} role
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>}
   */
  async findByRole(role, options = {}) {
    return await this.find({ role }, options)
  }

  /**
   * Find active users only
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.find({ isActive: true }, options)
  }

  /**
   * Check if email exists (for unique validation)
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    if (!email) return false
    const count = await this.Model.countDocuments({ email: email.toLowerCase() })
    return count > 0
  }

  /**
   * Check if username exists
   * @param {string} username
   * @returns {Promise<boolean>}
   */
  async usernameExists(username) {
    if (!username) return false
    const count = await this.Model.countDocuments({ username: username.toLowerCase() })
    return count > 0
  }

  /**
   * Update user role
   * @param {string} id
   * @param {string} role
   * @returns {Promise<Object|null>}
   */
  async updateRole(id, role) {
    if (!id || !role) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Deactivate user (soft delete alternative)
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async deactivate(id) {
    if (!id) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Reactivate user
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async activate(id) {
    if (!id) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Find user by ID - excludes password for security
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    if (!id) return null
    return await this.Model.findById(id).select('-password').lean()
  }

  /**
   * Update user password (hashed)
   * @param {string} id
   * @param {string} hashedPassword
   * @returns {Promise<Object|null>}
   */
  async updatePassword(id, hashedPassword) {
    if (!id || !hashedPassword) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { password: hashedPassword } },
      { new: true, runValidators: true }
    ).lean()
  }
}

module.exports = UserRepository
