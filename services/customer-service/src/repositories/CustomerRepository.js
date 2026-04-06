const BaseRepository = require('@travel-agency/shared-repositories')
const Customer = require('../models/Customer')

/**
 * CustomerRepository - manages customer profiles and loyalty data.
 * Syncs with User Service via events (denormalized data).
 */
class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer)
  }

  /**
   * Find customer by user ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    if (!userId) return null
    return await this.Model.findOne({ userId }).lean()
  }

  /**
   * Find customer by email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    if (!email) return null
    return await this.Model.findOne({ email: email.toLowerCase() }).lean()
  }

  /**
   * Find customers by loyalty tier
   * @param {string} tier
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByTier(tier, options = {}) {
    return await this.find({ loyaltyTier: tier }, options)
  }

  /**
   * Find VIP customers (Gold or Platinum)
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findVIP(options = {}) {
    return await this.find(
      { loyaltyTier: { $in: ['Gold', 'Platinum'] } },
      options
    )
  }

  /**
   * Find active customers (with isActive flag)
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.find({ isActive: true }, options)
  }

  /**
   * Update customer spending and bookings after completed order
   * @param {string} userId
   * @param {number} orderTotal
   * @returns {Promise<Object|null>}
   */
  async recordBooking(userId, orderTotal) {
    if (!userId) return null
    return await this.Model.findOneAndUpdate(
      { userId },
      {
        $inc: {
          totalBookings: 1,
          totalSpent: orderTotal,
          loyaltyPoints: Math.floor(orderTotal / 100)  // 1 point per $100
        },
        $set: {
          lastBookingDate: new Date(),
          'preferences.newsletterSubscribed': true  // Ensure subscribed after booking
        }
      },
      {
        new: true,
        runValidators: true,
        upsert: false  // Don't create if doesn't exist
      }
    ).lean()
  }

  /**
   * Update customer preferences
   * @param {string} userId
   * @param {Object} preferences - Partial preferences object
   * @returns {Promise<Object|null>}
   */
  async updatePreferences(userId, preferences) {
    if (!userId || !preferences) return null
    return await this.Model.findOneAndUpdate(
      { userId },
      { $set: { [`preferences.${Object.keys(preferences)[0]}`]: Object.values(preferences)[0] } },
      { new: true }
    ).lean()
  }

  /**
   * Apply loyalty discount (calculate based on tier)
   * @param {string} userId
   * @param {number} baseAmount
   * @returns {Promise<number>} Discounted amount
   */
  async getDiscountedPrice(userId, baseAmount) {
    const customer = await this.findByUserId(userId)
    if (!customer) return baseAmount

    const discountRates = {
      Bronze: 0,
      Silver: 0.05,
      Gold: 0.10,
      Platinum: 0.15
    }

    const discount = discountRates[customer.loyaltyTier] || 0
    return Math.round(baseAmount * (1 - discount))
  }

  /**
   * Get customer statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return await this.Model.aggregate([
      {
        $group: {
          _id: '$loyaltyTier',
          count: { $sum: 1 },
          avgSpent: { $avg: '$totalSpent' },
          totalCustomers: { $sum: 1 }
        }
      }
    ])
  }

  /**
   * Deactivate customer (soft delete)
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async deactivate(userId) {
    if (!userId) return null
    return await this.Model.findOneAndUpdate(
      { userId },
      { $set: { isActive: false } },
      { new: true }
    ).lean()
  }

  /**
   * Update customer profile (allowed fields only)
   * @param {string} userId
   * @param {Object} updates - Partial update (phone, address, preferences)
   * @returns {Promise<Object|null>}
   */
  async updateProfile(userId, updates) {
    if (!userId || !updates) return null

    // Only allow certain fields to be updated
    const allowedFields = ['phone', 'address', 'preferences']
    const updateData = {}
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = updates[key]
      }
    })

    if (Object.keys(updateData).length === 0) {
      return null
    }

    return await this.Model.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean()
  }
}

module.exports = CustomerRepository
