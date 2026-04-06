const BaseRepository = require('@travel-agency/shared-repositories')
const Admin = require('../models/Admin')

/**
 * AdminRepository - manages admin/agent accounts and permissions.
 */
class AdminRepository extends BaseRepository {
  constructor() {
    super(Admin)
  }

  /**
   * Find admin by user ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    if (!userId) return null
    return await this.Model.findOne({ userId }).lean()
  }

  /**
   * Find admin by email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    if (!email) return null
    return await this.Model.findOne({ email: email.toLowerCase() }).lean()
  }

  /**
   * Find admins by role
   * @param {string} role
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByRole(role, options = {}) {
    return await this.find({ role }, options)
  }

  /**
   * Find active admins
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.find({ isActive: true }, options)
  }

  /**
   * Find agents only (not SuperAdmins/Admins)
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findAgents(options = {}) {
    return await this.find({ role: 'Agent', isActive: true }, options)
  }

  /**
   * Find super admins
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findSuperAdmins(options = {}) {
    return await this.find({ role: 'SuperAdmin' }, options)
  }

  /**
   * Check if email exists (for uniqueness)
   * @param {string} email
   * @param {string} excludeId
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeId = null) {
    if (!email) return false
    const query = { email: email.toLowerCase() }
    if (excludeId) {
      query._id = { $ne: excludeId }
    }
    const count = await this.Model.countDocuments(query)
    return count > 0
  }

  /**
   * Grant API key to admin
   * @param {string} adminId
   * @returns {Promise<Object|null>}
   */
  async generateApiKey(adminId) {
    if (!adminId) return null
    const apiKey = 'aa_' + require('crypto').randomBytes(32).toString('hex')
    return await this.Model.findByIdAndUpdate(
      adminId,
      { $set: { apiKey } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Revoke API key
   * @param {string} adminId
   * @returns {Promise<Object|null>}
   */
  async revokeApiKey(adminId) {
    if (!adminId) return null
    return await this.Model.findByIdAndUpdate(
      adminId,
      { $unset: { apiKey: '' } },
      { new: true }
    ).lean()
  }

  /**
   * Verify API key
   * @param {string} apiKey
   * @returns {Promise<Object|null>}
   */
  async verifyApiKey(apiKey) {
    if (!apiKey) return null
    return await this.Model.findOne({ apiKey, isActive: true }).lean()
  }

  /**
   * Update admin role
   * @param {string} adminId
   * @param {string} role
   * @returns {Promise<Object|null>}
   */
  async updateRole(adminId, role) {
    if (!adminId || !role) return null
    return await this.Model.findByIdAndUpdate(
      adminId,
      { $set: { role } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Update admin permissions
   * @param {string} adminId
   * @param {Array} permissions
   * @returns {Promise<Object|null>}
   */
  async updatePermissions(adminId, permissions) {
    if (!adminId) return null
    return await this.Model.findByIdAndUpdate(
      adminId,
      { $set: { permissions } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Record login (increment counter)
   * @param {string} adminId
   * @returns {Promise<Object|null>}
   */
  async recordLogin(adminId) {
    if (!adminId) return null
    return await this.Model.findByIdAndUpdate(
      adminId,
      {
        $set: { lastLogin: new Date() },
        $inc: { loginCount: 1 }
      },
      { new: true }
    ).lean()
  }

  /**
   * Get admin dashboard statistics
   * @returns {Promise<Object>}
   */
  async getDashboardStats() {
    return await this.Model.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ])
  }

  /**
   * Get admin list with filtering and pagination
   * @param {Object} filters - { role, isActive, department }
   * @param {Object} options - { skip, limit, sort }
   * @returns {Promise<Array>}
   */
  async search(filters = {}, options = {}) {
    const query = {}

    if (filters.role) query.role = filters.role
    if (typeof filters.isActive === 'boolean') query.isActive = filters.isActive
    if (filters.department) query.department = filters.department

    return await this.find(query, options)
  }
}

module.exports = AdminRepository
