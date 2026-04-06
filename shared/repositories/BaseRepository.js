class BaseRepository {
  /**
   * @param {Model} Model - Mongoose model
   */
  constructor(Model) {
    this.Model = Model
  }

  /**
   * Find multiple documents with pagination, sorting, and filtering
   * @param {Object} query - MongoDB query filter
   * @param {Object} options - { skip, limit, sort }
   * @returns {Promise<Array>} Array of plain objects
   */
  async find(query = {}, options = {}) {
    const { skip = 0, limit = 100, sort = { createdAt: -1 } } = options
    return await this.Model.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sort)
      .lean()
  }

  /**
   * Find document by ID
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object|null>} Plain object or null
   */
  async findById(id) {
    if (!id) return null
    return await this.Model.findById(id).lean()
  }

  /**
   * Find one document by query
   * @param {Object} query - MongoDB query filter
   * @returns {Promise<Object|null>} Plain object or null
   */
  async findOne(query) {
    return await this.Model.findOne(query).lean()
  }

  /**
   * Create or update document
   * @param {Object} data - Document data (will be new if no _id)
   * @returns {Promise<Object>} Saved document as plain object
   */
  async save(data) {
    if (data._id) {
      // Update existing
      return await this.Model.findByIdAndUpdate(
        data._id,
        { $set: data },
        { new: true, runValidators: true }
      ).lean()
    }
    // Create new
    const doc = new this.Model(data)
    await doc.validate()
    return await doc.save()
  }

  /**
   * Delete document by ID
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<Object|null>} Deleted document or null
   */
  async delete(id) {
    if (!id) return null
    return await this.Model.findByIdAndDelete(id).lean()
  }

  /**
   * Count documents matching query
   * @param {Object} query - MongoDB query filter
   * @returns {Promise<number>} Count
   */
  async count(query = {}) {
    return await this.Model.countDocuments(query)
  }

  /**
   * Check if document exists
   * @param {string} id - MongoDB ObjectId
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    if (!id) return false
    return await this.Model.exists({ _id: id })
  }

  /**
   * Bulk create documents
   * @param {Array} documents - Array of document data
   * @returns {Promise<Array>} Created documents
   */
  async createMany(documents) {
    return await this.Model.insertMany(documents, { ordered: true })
  }

  /**
   * Bulk delete documents by query
   * @param {Object} query - MongoDB query filter
   * @returns {Promise<Object>} Delete result
   */
  async deleteMany(query) {
    return await this.Model.deleteMany(query)
  }
}

module.exports = BaseRepository
