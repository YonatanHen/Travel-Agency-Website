const BaseRepository = require('@travel-agency/shared-repositories')
const Order = require('../models/Order')

/**
 * OrderRepository handles order data access with saga-related patterns.
 */
class OrderRepository extends BaseRepository {
  constructor() {
    super(Order)
  }

  /**
   * Find orders by user ID
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByUser(userId, options = {}) {
    return await this.find(
      { user: userId },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Find orders by customer email
   * @param {string} email
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByEmail(email, options = {}) {
    return await this.find(
      { userEmail: email.toLowerCase() },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Find orders by status
   * @param {string} status
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.find(
      { status },
      options
    )
  }

  /**
   * Find orders by package ID
   * @param {string} packageId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByPackage(packageId, options = {}) {
    return await this.find(
      { package: packageId },
      options
    )
  }

  /**
   * Find orders with travel date on or after a specific date
   * @param {Date} date
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findUpcoming(date, options = {}) {
    return await this.find(
      {
        travelDate: { $gte: date },
        status: { $in: ['Pending', 'Confirmed'] }
      },
      { ...options, sort: { travelDate: 1 } }
    )
  }

  /**
   * Find orders with travel date in the past (for reporting)
   * @param {Date} date
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findPast(date, options = {}) {
    return await this.find(
      {
        travelDate: { $lt: date },
        status: 'Confirmed'
      },
      { ...options, sort: { travelDate: -1 } }
    )
  }

  /**
   * Get order statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    return await this.Model.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ])
  }

  /**
   * Get revenue by date range
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getRevenueByDateRange(startDate, endDate) {
    return await this.Model.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'Confirmed'
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' }
        }
      }
    ])
  }

  /**
   * Cancel order (with compensation tracking)
   * @param {string} id
   * @param {string} reason
   * @returns {Promise<Object|null>}
   */
  async cancel(id, reason) {
    if (!id) return null
    return await this.Model.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'Canceled',
          cancellationReason: reason,
          canceledAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Update order status
   * @param {string} id
   * @param {string} status
   * @returns {Promise<Object|null>}
   */
  async updateStatus(id, status) {
    if (!id || !status) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { status, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Bulk update order statuses (admin functionality)
   * @param {Array} ids
   * @param {string} status
   * @returns {Promise<Object>} Update result
   */
  async bulkUpdateStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { modifiedCount: 0 }
    }
    return await this.Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status, updatedAt: new Date() } }
    )
  }

  /**
   * Check if order belongs to user (for authorization)
   * @param {string} orderId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async belongsToUser(orderId, userId) {
    if (!orderId || !userId) return false
    // Use exists for efficient boolean check without fetching document
    return !!(await this.Model.exists({ _id: orderId, user: userId }))
  }
}

module.exports = OrderRepository
