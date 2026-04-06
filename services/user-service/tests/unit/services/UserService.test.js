const UserService = require('../../../src/services/UserService')
const UserRepository = require('../../../src/repositories/UserRepository')

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}))

const bcrypt = require('bcryptjs')

// Mock auth service
jest.mock('../../../src/utils/auth', () => ({
  getAuthService: () => ({
    generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
    generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token')
  })
}))

describe('UserService', () => {
  let userService
  let mockUserRepository

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock repository
    mockUserRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findByUsernameOrEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findById: jest.fn()
    }

    userService = new UserService(mockUserRepository)
  })

  describe('validateRegistration()', () => {
    it('should pass with valid data', async () => {
      const data = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
      }

      await expect(userService.validateRegistration(data)).resolves.not.toThrow()
    })

    it('should reject short username', async () => {
      const data = {
        username: 'jo',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
      }

      await expect(userService.validateRegistration(data)).rejects.toThrow('Username must be at least 3 characters')
    })

    it('should reject invalid email', async () => {
      const data = {
        username: 'john',
        email: 'invalid-email',
        password: 'password123',
        confirmPass: 'password123'
      }

      await expect(userService.validateRegistration(data)).rejects.toThrow('Invalid email address')
    })

    it('should reject short password', async () => {
      const data = {
        username: 'john',
        email: 'john@example.com',
        password: '123',
        confirmPass: '123'
      }

      await expect(userService.validateRegistration(data)).rejects.toThrow('Password must be at least 6 characters')
    })

    it('should reject mismatched passwords', async () => {
      const data = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'different'
      }

      await expect(userService.validateRegistration(data)).rejects.toThrow('Passwords do not match')
    })
  })

  describe('registerUser()', () => {
    it('should register new user successfully', async () => {
      const userData = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
      }

      // Mock: no existing user
      mockUserRepository.findByUsername.mockResolvedValue(null)
      mockUserRepository.findByEmail.mockResolvedValue(null)

      // Mock bcrypt hash
      const hashedPassword = '$2a$10$hashedpassword'
      bcrypt.hash.mockResolvedValue(hashedPassword)

      // Mock save to return created user
      const savedUser = {
        _id: '123',
        username: 'john',
        email: 'john@example.com',
        role: 'Customer'
      }
      mockUserRepository.save.mockResolvedValue(savedUser)
      mockUserRepository.findById.mockResolvedValue(savedUser)

      const result = await userService.registerUser(userData)

      // Verify calls
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('john')
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com')
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        username: 'john',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'Customer'
      })
      expect(result).toEqual(savedUser)
    })

    it('should throw ConflictError if username exists', async () => {
      const userData = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
      }

      mockUserRepository.findByUsername.mockResolvedValue({ _id: '999', username: 'john' })

      await expect(userService.registerUser(userData)).rejects.toThrow('Username already exists')
    })

    it('should throw ConflictError if email exists', async () => {
      const userData = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
      }

      mockUserRepository.findByUsername.mockResolvedValue(null)
      mockUserRepository.findByEmail.mockResolvedValue({ _id: '999', email: 'john@example.com' })

      await expect(userService.registerUser(userData)).rejects.toThrow('Email already registered')
    })

    it('should use default role Customer if not provided', async () => {
      const userData = {
        username: 'john',
        email: 'john@example.com',
        password: 'password123',
        confirmPass: 'password123'
        // role not provided
      }

      mockUserRepository.findByUsername.mockResolvedValue(null)
      mockUserRepository.findByEmail.mockResolvedValue(null)
      bcrypt.hash.mockResolvedValue('hashed')
      mockUserRepository.save.mockResolvedValue({ _id: '123', username: 'john', email: 'john@example.com' })
      mockUserRepository.findById.mockResolvedValue({ _id: '123', username: 'john', email: 'john@example.com', role: 'Customer' })

      await userService.registerUser(userData)

      expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        role: 'Customer'
      }))
    })
  })

  describe('loginUser()', () => {
    it('should login successfully and return tokens', async () => {
      const user = {
        _id: '123',
        username: 'john',
        email: 'john@example.com',
        role: 'Customer'
      }

      mockUserRepository.findByUsernameOrEmail.mockResolvedValue(user)
      bcrypt.compare.mockResolvedValue(true)

      const result = await userService.loginUser('john', 'password123')

      expect(mockUserRepository.findByUsernameOrEmail).toHaveBeenCalledWith('john')
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', user.password)
      expect(result).toEqual({
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        user: expect.objectContaining({
          _id: '123',
          username: 'john',
          email: 'john@example.com',
          role: 'Customer'
        })
      })
    })

    it('should throw AuthenticationError for invalid credentials', async () => {
      mockUserRepository.findByUsernameOrEmail.mockResolvedValue(null)

      await expect(userService.loginUser('nonexistent', 'password')).rejects.toThrow('Invalid credentials')
    })

    it('should throw AuthenticationError for wrong password', async () => {
      const user = {
        _id: '123',
        username: 'john',
        password: 'hashedpassword'
      }

      mockUserRepository.findByUsernameOrEmail.mockResolvedValue(user)
      bcrypt.compare.mockResolvedValue(false)

      await expect(userService.loginUser('john', 'wrongpassword')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('getUserById()', () => {
    it('should return user by ID', async () => {
      const user = { _id: '123', username: 'john', email: 'john@example.com' }
      mockUserRepository.findById.mockResolvedValue(user)

      const result = await userService.getUserById('123')

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123')
      expect(result).toEqual(user)
    })

    it('should throw NotFoundError if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null)

      await expect(userService.getUserById('999')).rejects.toThrow('User not found')
    })
  })
})
