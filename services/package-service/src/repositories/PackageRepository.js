const BaseRepository = require('@travel-agency/shared-repositories')
const Package = require('../models/Package')

/**
 * PackageRepository handles data access for travel packages.
 */
class PackageRepository extends BaseRepository {
  constructor() {
    super(Package)
  }

  /**
   * Find packages by destination
   * @param {string} destination
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByDestination(destination, options = {}) {
    if (!destination) return []
    return await this.find(
      { destination: new RegExp(destination, 'i'), isActive: true },
      options
    )
  }

  /**
   * Find packages with minimum rating
   * @param {number} minRating
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByMinRating(minRating, options = {}) {
    return await this.find(
      { rating: { $gte: minRating }, isActive: true },
      options
    )
  }

  /**
   * Find packages within price range
   * @param {number} minPrice
   * @param {number} maxPrice
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    const query = {
      price: { $gte: minPrice, $lte: maxPrice },
      isActive: true
    }
    return await this.find(query, options)
  }

  /**
   * Find packages by duration
   * @param {number} days
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByDuration(days, options = {}) {
    return await this.find(
      { duration: days, isActive: true },
      options
    )
  }

  /**
   * Search packages by name or description (full-text like)
   * @param {string} searchTerm
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    if (!searchTerm) return []
    const regex = new RegExp(searchTerm, 'i')
    return await this.find(
      {
        $or: [
          { name: regex },
          { description: regex },
          { destination: regex }
        ],
        isActive: true
      },
      options
    )
  }

  /**
   * Find active packages (isActive: true)
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.find({ isActive: true }, options)
  }

  /**
   * Check if package name exists (for uniqueness validation)
   * @param {string} name
   * @param {string} excludeId - Optional package ID to exclude (for updates)
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    if (!name) return false
    const query = { name: new RegExp('^' + name + '$', 'i') }
    if (excludeId) {
      query._id = { $ne: excludeId }
    }
    const count = await this.Model.countDocuments(query)
    return count > 0
  }

  /**
   * Decrement package quantity (atomically)
   * @param {string} id
   * @param {number} quantity - Amount to decrement
   * @returns {Promise<Object|null>} Updated package
   */
  async decrementQuantity(id, quantity = 1) {
    if (!id || quantity <= 0) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $inc: { quantity: -quantity }, $set: { updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Add a rating to a package (incremental average)
   * @param {string} id
   * @param {number} rating - New rating value (0-5)
   * @returns {Promise<Object>|null} Updated package with new avg rating
   */
  async addRating(id, rating) {
    if (!id || rating === undefined) return null
    const pkg = await this.Model.findById(id)
    if (!pkg) return null

    // Use instance method to update rating average
    await pkg.updateRating(rating)
    // Return updated package without extra queries? We have pkg after save.
    return pkg.toObject ? pkg.toObject() : pkg
  }

  /**
   * Increment package quantity (compensation transaction)
   * @param {string} id
   * @param {number} quantity - Amount to increment
   * @returns {Promise<Object|null>} Updated package
   */
  async incrementQuantity(id, quantity = 1) {
    if (!id || quantity <= 0) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $inc: { quantity: quantity }, $set: { updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean()
  }

  /**
   * Get package statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    return await this.Model.aggregate([
      {
        $group: {
          _id: null,
          totalPackages: { $sum: 1 },
          activePackages: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          avgPrice: { $avg: '$price' },
          avgRating: { $avg: '$rating' },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ])
  }
}

module.exports = PackageRepository
