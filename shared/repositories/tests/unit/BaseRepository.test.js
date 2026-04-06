const BaseRepository = require('../../BaseRepository')

describe('BaseRepository', () => {
  let mockModel
  let repository

  beforeEach(() => {
    // Create a mock Mongoose model
    mockModel = {
      find: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockReturnThis(),
      exists: jest.fn().mockReturnThis(),
      save: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockReturnThis(),
      insertMany: jest.fn().mockResolvedValue([]),
      findByIdAndUpdate: jest.fn().mockReturnThis(),
      findOneAndUpdate: jest.fn().mockReturnThis(),
      findByIdAndDelete: jest.fn().mockReturnThis(),
      deleteMany: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
      // For mongoose model instances
      create: jest.fn().mockImplementation((doc) => ({ ...doc, _id: '123' }))
    }

    repository = new BaseRepository(mockModel)
  })

  describe('find()', () => {
    it('should execute find with query and options', async () => {
      const query = { status: 'active' }
      const options = { skip: 10, limit: 5, sort: { createdAt: -1 } }

      mockModel.find.mockReturnThis()
      mockModel.skip.mockReturnThis()
      mockModel.limit.mockReturnThis()
      mockModel.sort.mockReturnThis()
      mockModel.lean.mockResolvedValue([])

      const result = await repository.find(query, options)

      expect(mockModel.find).toHaveBeenCalledWith(query)
      expect(mockModel.skip).toHaveBeenCalledWith(10)
      expect(mockModel.limit).toHaveBeenCalledWith(5)
      expect(mockModel.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(mockModel.lean).toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should use default options when not provided', async () => {
      mockModel.find.mockReturnThis()
      mockModel.skip.mockReturnThis()
      mockModel.limit.mockReturnThis()
      mockModel.sort.mockReturnThis()
      mockModel.lean.mockResolvedValue([])

      await repository.find()

      expect(mockModel.find).toHaveBeenCalledWith({})
      expect(mockModel.skip).toHaveBeenCalledWith(0)
      expect(mockModel.limit).toHaveBeenCalledWith(100)
      expect(mockModel.sort).toHaveBeenCalledWith({ createdAt: -1 })
    })
  })

  describe('findById()', () => {
    it('should find document by ID', async () => {
      const doc = { _id: '123', name: 'Test' }
      mockModel.findById.mockReturnThis()
      mockModel.lean.mockResolvedValue(doc)

      const result = await repository.findById('123')

      expect(mockModel.findById).toHaveBeenCalledWith('123')
      expect(result).toEqual(doc)
    })

    it('should return null for invalid ID', async () => {
      const result = await repository.findById(null)
      expect(result).toBeNull()
    })
  })

  describe('save()', () => {
    it('should create new document when no _id', async () => {
      const data = { name: 'New Doc' }
      const saved = { _id: '123', name: 'New Doc' }
      mockModel.new = jest.fn().mockImplementation((data) => saved)
      mockModel.validate = jest.fn().mockResolvedValue()
      mockModel.save = jest.fn().mockResolvedValue(saved)

      const result = await repository.save(data)

      expect(mockModel.new).toHaveBeenCalledWith(data)
      expect(mockModel.validate).toHaveBeenCalled()
      expect(result).toEqual(saved)
    })

    it('should update existing document when _id present', async () => {
      const data = { _id: '123', name: 'Updated' }
      const updated = { _id: '123', name: 'Updated' }
      mockModel.findByIdAndUpdate.mockReturnThis()
      mockModel.lean.mockResolvedValue(updated)

      const result = await repository.save(data)

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith('123', { $set: data }, { new: true, runValidators: true })
      expect(result).toEqual(updated)
    })
  })

  describe('delete()', () => {
    it('should delete document by ID', async () => {
      const deleted = { _id: '123', name: 'Deleted' }
      mockModel.findByIdAndDelete.mockReturnThis()
      mockModel.lean.mockResolvedValue(deleted)

      const result = await repository.delete('123')

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('123')
      expect(result).toEqual(deleted)
    })

    it('should return null if ID is invalid', async () => {
      const result = await repository.delete(null)
      expect(result).toBeNull()
    })
  })

  describe('count()', () => {
    it('should return count of matching documents', async () => {
      mockModel.countDocuments.mockResolvedValue(42)

      const result = await repository.count({ status: 'active' })

      expect(mockModel.countDocuments).toHaveBeenCalledWith({ status: 'active' })
      expect(result).toBe(42)
    })

    it('should count all when no query provided', async () => {
      mockModel.countDocuments.mockResolvedValue(100)

      const result = await repository.count()

      expect(mockModel.countDocuments).toHaveBeenCalledWith({})
      expect(result).toBe(100)
    })
  })

  describe('exists()', () => {
    it('should return true if document exists', async () => {
      mockModel.exists.mockResolvedValue({ _id: '123' })

      const result = await repository.exists('123')

      expect(mockModel.exists).toHaveBeenCalledWith({ _id: '123' })
      expect(result).toBe(true)
    })

    it('should return false if document does not exist', async () => {
      mockModel.exists.mockResolvedValue(null)

      const result = await repository.exists('123')

      expect(result).toBe(false)
    })

    it('should return false for invalid ID', async () => {
      const result = await repository.exists(null)
      expect(result).toBe(false)
    })
  })
})
