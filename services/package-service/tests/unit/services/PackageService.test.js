const PackageService = require('../../../src/services/PackageService')
const { AppError } = require('@travel-agency/shared-errors')

describe('PackageService', () => {
  let packageRepository
  let packageService

  beforeEach(() => {
    packageRepository = {
      nameExists: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findByDestination: jest.fn(),
      addRating: jest.fn(),
      incrementQuantity: jest.fn(),
      decrementQuantity: jest.fn()
    }
    packageService = new PackageService(packageRepository)
  })

  describe('createPackage()', () => {
    it('creates package with valid input', async () => {
      const input = {
        name: 'Paris Escape',
        description: 'A nice trip',
        destination: 'Paris',
        price: 1200,
        duration: 5,
        quantity: 10
      }
      packageRepository.nameExists.mockResolvedValue(false)
      packageRepository.save.mockResolvedValue({ _id: 'p1', ...input })

      const result = await packageService.createPackage(input)

      expect(packageRepository.nameExists).toHaveBeenCalledWith('Paris Escape')
      expect(result._id).toBe('p1')
    })

    it('throws 409 when package name already exists', async () => {
      packageRepository.nameExists.mockResolvedValue(true)

      await expect(packageService.createPackage({
        name: 'Paris Escape',
        description: 'A nice trip',
        destination: 'Paris',
        price: 1200,
        duration: 5
      })).rejects.toEqual(expect.objectContaining({
        statusCode: 409
      }))
    })
  })

  describe('getPackageById()', () => {
    it('returns package when found and active', async () => {
      packageRepository.findById.mockResolvedValue({ _id: 'p1', isActive: true })
      const result = await packageService.getPackageById('p1')
      expect(result._id).toBe('p1')
    })

    it('throws 404 when package is missing', async () => {
      packageRepository.findById.mockResolvedValue(null)
      await expect(packageService.getPackageById('missing'))
        .rejects.toEqual(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('listPackages()', () => {
    it('returns paginated list', async () => {
      packageRepository.find.mockResolvedValue([{ _id: 'p1' }])
      packageRepository.count.mockResolvedValue(1)

      const result = await packageService.listPackages({ page: '1', limit: '10' })

      expect(packageRepository.find).toHaveBeenCalled()
      expect(result.total).toBe(1)
      expect(result.totalPages).toBe(1)
      expect(result.packages).toHaveLength(1)
    })
  })

  describe('addRating()', () => {
    it('adds rating when valid', async () => {
      packageRepository.addRating.mockResolvedValue({ _id: 'p1', rating: 4.5 })

      const result = await packageService.addRating('p1', 5)

      expect(packageRepository.addRating).toHaveBeenCalledWith('p1', 5)
      expect(result.rating).toBe(4.5)
    })

    it('throws 400 for invalid rating', async () => {
      await expect(packageService.addRating('p1', 6))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }))
    })
  })

  describe('quantity operations', () => {
    it('increments quantity when package exists', async () => {
      packageRepository.incrementQuantity.mockResolvedValue({ _id: 'p1', quantity: 11 })
      const result = await packageService.incrementQuantity('p1', 1)
      expect(result.quantity).toBe(11)
    })

    it('decrements quantity with stock check', async () => {
      packageRepository.findById.mockResolvedValue({ _id: 'p1', isActive: true, quantity: 3 })
      packageRepository.decrementQuantity.mockResolvedValue({ _id: 'p1', quantity: 2 })

      const result = await packageService.decrementQuantity('p1', 1)
      expect(result.quantity).toBe(2)
    })

    it('throws 400 when decrement exceeds stock', async () => {
      packageRepository.findById.mockResolvedValue({ _id: 'p1', isActive: true, quantity: 0 })

      await expect(packageService.decrementQuantity('p1', 1))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }))
    })
  })

  it('uses AppError-compatible objects from shared-errors', async () => {
    packageRepository.findById.mockResolvedValue(null)
    try {
      await packageService.getPackageById('missing')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
    }
  })
})
