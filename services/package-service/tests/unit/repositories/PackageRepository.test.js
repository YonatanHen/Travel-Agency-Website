const PackageRepository = require('../../../src/repositories/PackageRepository')
const Package = require('../../../src/models/Package')

jest.mock('../../../src/models/Package')

describe('PackageRepository', () => {
  let pkgRepo

  beforeEach(() => {
    jest.resetAllMocks()
    pkgRepo = new PackageRepository()
  })

  describe('findByDestination()', () => {
    it('should find packages by destination', async () => {
      const packages = [{ destination: 'Paris' }]
      Package.find = jest.fn().mockReturnThis()
      Package.skip = jest.fn().mockReturnThis()
      Package.limit = jest.fn().mockReturnThis()
      Package.sort = jest.fn().mockReturnThis()
      Package.lean = jest.fn().mockResolvedValue(packages)

      const result = await pkgRepo.findByDestination('Paris', { limit: 5 })

      expect(Package.find).toHaveBeenCalledWith({ destination: expect.anything(), isActive: true })
      expect(result).toEqual(packages)
    })
  })

  describe('findByMinRating()', () => {
    it('should find packages with rating >= min', async () => {
      const packages = [{ rating: 4.5 }]
      Package.find = jest.fn().mockReturnThis()
      Package.skip = jest.fn().mockReturnThis()
      Package.limit = jest.fn().mockReturnThis()
      Package.sort = jest.fn().mockReturnThis()
      Package.lean = jest.fn().mockResolvedValue(packages)

      await pkgRepo.findByMinRating(4)

      // find() is called with query only; options applied via chaining
      expect(Package.find).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: { $gte: 4 },
          isActive: true
        })
      )
    })
  })

  describe('search()', () => {
    it('should search by name, description, or destination', async () => {
      const packages = [{ name: 'Paris Getaway' }]
      Package.find = jest.fn().mockReturnThis()
      Package.skip = jest.fn().mockReturnThis()
      Package.limit = jest.fn().mockReturnThis()
      Package.sort = jest.fn().mockReturnThis()
      Package.lean = jest.fn().mockResolvedValue(packages)

      await pkgRepo.search('Paris')

      // find() called with query only; options via chain
      expect(Package.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array),
          isActive: true
        })
      )
    })
  })

  describe('nameExists()', () => {
    it('should check if package name exists', async () => {
      Package.countDocuments = jest.fn().mockResolvedValue(1)
      const exists = await pkgRepo.nameExists('Paris Package')
      expect(exists).toBe(true)
    })

    it('should return false if name does not exist', async () => {
      Package.countDocuments = jest.fn().mockResolvedValue(0)
      const exists = await pkgRepo.nameExists('Unknown')
      expect(exists).toBe(false)
    })
  })

  describe('decrementQuantity() and incrementQuantity()', () => {
    it('should decrement package quantity', async () => {
      const updated = { _id: 'p1', quantity: 9 }
      Package.findByIdAndUpdate = jest.fn().mockReturnThis()
      Package.lean = jest.fn().mockResolvedValue(updated)

      const result = await pkgRepo.decrementQuantity('p1', 1)

      expect(Package.findByIdAndUpdate).toHaveBeenCalledWith('p1', { $inc: { quantity: -1 }, $set: { updatedAt: expect.anything() } }, { new: true, runValidators: true })
      expect(result.quantity).toBe(9)
    })

    it('should increment package quantity', async () => {
      const updated = { _id: 'p1', quantity: 11 }
      Package.findByIdAndUpdate = jest.fn().mockReturnThis()
      Package.lean = jest.fn().mockResolvedValue(updated)

      const result = await pkgRepo.incrementQuantity('p1')

      expect(Package.findByIdAndUpdate).toHaveBeenCalledWith('p1', { $inc: { quantity: 1 }, $set: { updatedAt: expect.anything() } }, { new: true, runValidators: true })
      expect(result.quantity).toBe(11)
    })
  })

  describe('getStats()', () => {
    it('should return package statistics', async () => {
      const stats = [{ _id: null, totalPackages: 10, activePackages: 8, avgPrice: 1500 }]
      Package.aggregate = jest.fn().mockResolvedValue(stats)

      const result = await pkgRepo.getStats()

      expect(Package.aggregate).toHaveBeenCalled()
      expect(result).toEqual(stats)
    })
  })

  describe('addRating()', () => {
    it('should add rating and update average', async () => {
      const pkg = {
        _id: 'p1',
        rating: 4,
        reviewCount: 2,
        updateRating: jest.fn().mockResolvedValue(4.3),
        toObject: jest.fn().mockReturnValue({ _id: 'p1', rating: 4.3, reviewCount: 3 })
      }
      Package.findById = jest.fn().mockResolvedValue(pkg)

      const result = await pkgRepo.addRating('p1', 5)

      expect(Package.findById).toHaveBeenCalledWith('p1')
      expect(pkg.updateRating).toHaveBeenCalledWith(5)
      expect(result).toEqual({ _id: 'p1', rating: 4.3, reviewCount: 3 })
    })

    it('should return null if package not found', async () => {
      Package.findById = jest.fn().mockResolvedValue(null)
      const result = await pkgRepo.addRating('p1', 5)
      expect(result).toBeNull()
    })

    it('should return null if invalid input', async () => {
      const result = await pkgRepo.addRating(null, undefined)
      expect(result).toBeNull()
    })
  })
})
