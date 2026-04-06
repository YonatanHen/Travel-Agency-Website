const UserRepository = require('../../../src/repositories/UserRepository')
const User = require('../../../src/models/User')

// Mock the User model
jest.mock('../../../src/models/User')

describe('UserRepository', () => {
  let userRepo

  beforeEach(() => {
    // Reset all mocks to pristine state before each test
    jest.resetAllMocks()
    userRepo = new UserRepository()
  })

  describe('findByEmail()', () => {
    it('should find user by email (case-insensitive) and exclude password', async () => {
      const user = { _id: '123', email: 'test@example.com', username: 'test' }
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(user)
      })

      const result = await userRepo.findByEmail('test@example.com')

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' })
      expect(User.findOne().select).toHaveBeenCalledWith('-password')
      expect(result).toEqual(user)
    })

    it('should return null if email not provided', async () => {
      const result = await userRepo.findByEmail(null)
      expect(result).toBeNull()
    })

    it('should return null if not found', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      })

      const result = await userRepo.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('findByUsername()', () => {
    it('should find user by username and exclude password', async () => {
      const user = { _id: '123', username: 'john' }
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(user)
      })

      const result = await userRepo.findByUsername('john')

      expect(User.findOne).toHaveBeenCalledWith({ username: 'john' })
      expect(User.findOne().select).toHaveBeenCalledWith('-password')
      expect(result).toEqual(user)
    })

    it('should return null for invalid username', async () => {
      const result = await userRepo.findByUsername('')
      expect(result).toBeNull()
    })
  })

  describe('findByUsernameOrEmail()', () => {
    it('should find user by username or email (includes password for auth)', async () => {
      const user = { _id: '123', username: 'john', email: 'john@example.com', password: 'hashed' }
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(user)
      })

      const result = await userRepo.findByUsernameOrEmail('john')

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'john' }, { email: 'john' }]
      })
      expect(result).toEqual(user)
    })

    it('should find by email when username not found', async () => {
      const user = { email: 'jane@example.com', password: 'hashed' }
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(user)
      })

      await userRepo.findByUsernameOrEmail('jane@example.com')

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'jane@example.com' }, { email: 'jane@example.com' }]
      })
    })
  })

  describe('findById()', () => {
    it('should find user by ID and exclude password', async () => {
      const user = { _id: '123', username: 'john', email: 'john@example.com' }
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(user)
      })

      const result = await userRepo.findById('123')

      expect(User.findById).toHaveBeenCalledWith('123')
      expect(User.findById().select).toHaveBeenCalledWith('-password')
      expect(result).toEqual(user)
    })

    it('should return null for invalid ID', async () => {
      const result = await userRepo.findById(null)
      expect(result).toBeNull()
    })
  })

  describe('updatePassword()', () => {
    it('should update password for user', async () => {
      const updated = { _id: '123', password: 'newhashed' }
      User.findByIdAndUpdate.mockReturnThis()
      User.lean = jest.fn().mockResolvedValue(updated)

      const result = await userRepo.updatePassword('123', 'newhashed')

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', { $set: { password: 'newhashed' } }, { new: true, runValidators: true })
      expect(result.password).toBe('newhashed')
    })

    it('should return null if ID missing', async () => {
      const result = await userRepo.updatePassword(null, 'hash')
      expect(result).toBeNull()
    })
  })

  describe('findByRole()', () => {
    it('should find users by role', async () => {
      const users = [{ _id: '1', role: 'Admin' }]
      userRepo.Model = User
      User.find = jest.fn().mockReturnThis()
      User.skip = jest.fn().mockReturnThis()
      User.limit = jest.fn().mockReturnThis()
      User.sort = jest.fn().mockReturnThis()
      User.lean = jest.fn().mockResolvedValue(users)

      const result = await userRepo.findByRole('Admin', { limit: 10 })

      expect(User.find).toHaveBeenCalledWith({ role: 'Admin' })
      expect(User.limit).toHaveBeenCalledWith(10)
      expect(result).toEqual(users)
    })
  })

  describe('emailExists()', () => {
    it('should return true if email exists', async () => {
      User.countDocuments.mockResolvedValue(1)

      const result = await userRepo.emailExists('test@example.com')

      expect(User.countDocuments).toHaveBeenCalledWith({ email: 'test@example.com' })
      expect(result).toBe(true)
    })

    it('should return false if email does not exist', async () => {
      User.countDocuments.mockResolvedValue(0)
      const result = await userRepo.emailExists('new@example.com')
      expect(result).toBe(false)
    })

    it('should return false for empty email', async () => {
      const result = await userRepo.emailExists('')
      expect(result).toBe(false)
    })
  })

  describe('deactivate() and activate()', () => {
    it('should deactivate user', async () => {
      const deactivated = { _id: '123', isActive: false }
      User.findByIdAndUpdate.mockReturnThis()
      User.lean = jest.fn().mockResolvedValue(deactivated)

      const result = await userRepo.deactivate('123')

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', { $set: { isActive: false } }, { new: true, runValidators: true })
      expect(result.isActive).toBe(false)
    })

    it('should activate user', async () => {
      const activated = { _id: '123', isActive: true }
      User.findByIdAndUpdate.mockReturnThis()
      User.lean = jest.fn().mockResolvedValue(activated)

      const result = await userRepo.activate('123')

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', { $set: { isActive: true } }, { new: true, runValidators: true })
      expect(result.isActive).toBe(true)
    })
  })
})
