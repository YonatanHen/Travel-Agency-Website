const Joi = require('joi')
const {
  BadRequestError,
  NotFoundError,
  ConflictError
} = require('@travel-agency/shared-errors')

class PackageService {
  constructor(packageRepository) {
    this.packageRepository = packageRepository
  }

  async createPackage(data) {
    const payload = this.validateCreatePayload(data)

    const exists = await this.packageRepository.nameExists(payload.name)
    if (exists) {
      throw ConflictError('Package name already exists')
    }

    return this.packageRepository.save(payload)
  }

  async getPackageById(id) {
    this.validateObjectIdInput(id, 'Package ID is required')
    const pkg = await this.packageRepository.findById(id)
    if (!pkg || !pkg.isActive) {
      throw NotFoundError('Package not found')
    }
    return pkg
  }

  async updatePackage(id, updates) {
    this.validateObjectIdInput(id, 'Package ID is required')
    const payload = this.validateUpdatePayload(updates)

    const existing = await this.packageRepository.findById(id)
    if (!existing || !existing.isActive) {
      throw NotFoundError('Package not found')
    }

    if (payload.name) {
      const exists = await this.packageRepository.nameExists(payload.name, id)
      if (exists) {
        throw ConflictError('Package name already exists')
      }
    }

    return this.packageRepository.save({
      ...existing,
      ...payload,
      _id: id
    })
  }

  async deletePackage(id) {
    this.validateObjectIdInput(id, 'Package ID is required')

    const existing = await this.packageRepository.findById(id)
    if (!existing || !existing.isActive) {
      throw NotFoundError('Package not found')
    }

    return this.packageRepository.save({
      ...existing,
      _id: id,
      isActive: false
    })
  }

  async listPackages(options = {}) {
    const parsed = this.parseListOptions(options)

    const query = { isActive: true }
    if (parsed.destination) {
      query.destination = new RegExp(parsed.destination, 'i')
    }
    if (parsed.minPrice !== null || parsed.maxPrice !== null) {
      query.price = {}
      if (parsed.minPrice !== null) query.price.$gte = parsed.minPrice
      if (parsed.maxPrice !== null) query.price.$lte = parsed.maxPrice
    }
    if (parsed.minRating !== null) {
      query.rating = { $gte: parsed.minRating }
    }
    if (parsed.search) {
      const regex = new RegExp(parsed.search, 'i')
      query.$or = [{ name: regex }, { description: regex }, { destination: regex }]
    }

    const [packages, total] = await Promise.all([
      this.packageRepository.find(query, {
        skip: parsed.skip,
        limit: parsed.limit,
        sort: parsed.sort
      }),
      this.packageRepository.count(query)
    ])

    return {
      packages,
      total,
      page: parsed.page,
      limit: parsed.limit,
      totalPages: Math.ceil(total / parsed.limit) || 0
    }
  }

  async findByDestination(destination, options = {}) {
    if (!destination) {
      throw BadRequestError('Destination is required')
    }

    const parsed = this.parseListOptions(options)
    return this.packageRepository.findByDestination(destination, parsed)
  }

  async addRating(packageId, rating) {
    this.validateObjectIdInput(packageId, 'Package ID is required')

    const numericRating = Number(rating)
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      throw BadRequestError('Rating must be a number between 1 and 5')
    }

    const updated = await this.packageRepository.addRating(packageId, numericRating)
    if (!updated) {
      throw NotFoundError('Package not found')
    }

    return updated
  }

  async incrementQuantity(packageId, amount = 1) {
    this.validateObjectIdInput(packageId, 'Package ID is required')
    const qty = this.validateQuantityAmount(amount)

    const updated = await this.packageRepository.incrementQuantity(packageId, qty)
    if (!updated) {
      throw NotFoundError('Package not found')
    }
    return updated
  }

  async decrementQuantity(packageId, amount = 1) {
    this.validateObjectIdInput(packageId, 'Package ID is required')
    const qty = this.validateQuantityAmount(amount)

    const existing = await this.packageRepository.findById(packageId)
    if (!existing || !existing.isActive) {
      throw NotFoundError('Package not found')
    }
    if (existing.quantity < qty) {
      throw BadRequestError('Insufficient package quantity')
    }

    const updated = await this.packageRepository.decrementQuantity(packageId, qty)
    if (!updated) {
      throw NotFoundError('Package not found')
    }
    return updated
  }

  validateCreatePayload(data) {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().max(1000).required(),
      destination: Joi.string().required(),
      price: Joi.number().min(0).required(),
      duration: Joi.number().integer().min(1).required(),
      quantity: Joi.number().integer().min(0).default(0),
      amenities: Joi.array().items(Joi.string()).default([]),
      imageUrl: Joi.string().uri().allow('', null),
      isActive: Joi.boolean().default(true)
    })

    const { error, value } = schema.validate(data)
    if (error) {
      throw BadRequestError(error.details[0].message)
    }
    return value
  }

  validateUpdatePayload(data) {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100),
      description: Joi.string().max(1000),
      destination: Joi.string(),
      price: Joi.number().min(0),
      duration: Joi.number().integer().min(1),
      quantity: Joi.number().integer().min(0),
      amenities: Joi.array().items(Joi.string()),
      imageUrl: Joi.string().uri().allow('', null),
      isActive: Joi.boolean()
    }).min(1)

    const { error, value } = schema.validate(data)
    if (error) {
      throw BadRequestError(error.details[0].message)
    }
    return value
  }

  parseListOptions(options = {}) {
    const page = Math.max(1, Number(options.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20))
    const skip = (page - 1) * limit
    const sort = this.parseSort(options.sort)

    return {
      page,
      limit,
      skip,
      sort,
      destination: options.destination || null,
      search: options.search || null,
      minPrice: this.toNullableNumber(options.minPrice),
      maxPrice: this.toNullableNumber(options.maxPrice),
      minRating: this.toNullableNumber(options.minRating)
    }
  }

  parseSort(sortInput) {
    if (!sortInput || typeof sortInput !== 'string') {
      return { createdAt: -1 }
    }

    const key = sortInput.startsWith('-') ? sortInput.slice(1) : sortInput
    const order = sortInput.startsWith('-') ? -1 : 1
    const allowed = ['createdAt', 'price', 'rating', 'name', 'duration']

    if (!allowed.includes(key)) {
      throw BadRequestError(`Invalid sort field: ${key}`)
    }

    return { [key]: order }
  }

  toNullableNumber(value) {
    if (value === undefined || value === null || value === '') {
      return null
    }
    const number = Number(value)
    if (Number.isNaN(number)) {
      throw BadRequestError('Numeric filter value is invalid')
    }
    return number
  }

  validateObjectIdInput(value, message) {
    if (!value || typeof value !== 'string') {
      throw BadRequestError(message)
    }
  }

  validateQuantityAmount(amount) {
    const qty = Number(amount)
    if (!Number.isInteger(qty) || qty < 1) {
      throw BadRequestError('Quantity amount must be a positive integer')
    }
    return qty
  }
}

module.exports = PackageService
