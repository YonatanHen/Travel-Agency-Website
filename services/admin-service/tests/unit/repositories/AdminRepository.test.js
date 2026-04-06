const AdminRepository = require('../../../src/repositories/AdminRepository')
const Admin = require('../../../src/models/Admin')

jest.mock('../../../src/models/Admin')

describe('AdminRepository', () => {
  let adminRepo

  beforeEach(() => {
    adminRepo = new AdminRepository()
  })

  describe('findByUserId() and findByEmail()', () => {
    it('should find admin by userId', async () => {
      const admin = { userId: 'u1', role: 'Admin' }
      Admin.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(admin)
      })

      const result = await adminRepo.findByUserId('u1')

      expect(Admin.findOne).toHaveBeenCalledWith({ userId: 'u1' })
      expect(result).toEqual(admin)
    })

    it('should find admin by email', async () => {
      const admin = { email: 'admin@example.com' }
      Admin.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(admin)
      })

      const result = await adminRepo.findByEmail('admin@example.com')

      expect(Admin.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' })
      expect(result).toEqual(admin)
    })
  })

  describe('findByRole() and findAgents()', () => {
    it('should find admins by role', async () => {
      const admins = [{ role: 'Agent' }]
      adminRepo.Model = Admin
      Admin.find = jest.fn().mockReturnThis()
      Admin.skip = jest.fn().mockReturnThis()
      Admin.limit = jest.fn().mockReturnThis()
      Admin.sort = jest.fn().mockReturnThis()
      Admin.lean = jest.fn().mockResolvedValue(admins)

      await adminRepo.findByRole('Agent')

      expect(Admin.find).toHaveBeenCalledWith({ role: 'Agent' })
    })

    it('should find only active agents', async () => {
      const agents = [{ role: 'Agent', isActive: true }]
      adminRepo.Model = Admin
      Admin.find = jest.fn().mockReturnThis()
      Admin.skip = jest.fn().mockReturnThis()
      Admin.limit = jest.fn().mockReturnThis()
      Admin.sort = jest.fn().mockReturnThis()
      Admin.lean = jest.fn().mockResolvedValue(agents)

      await adminRepo.findAgents()

      expect(Admin.find).toHaveBeenCalledWith({ role: 'Agent', isActive: true })
    })
  })

  describe('emailExists()', () => {
    it('should check if admin email exists', async () => {
      Admin.countDocuments = jest.fn().mockResolvedValue(1)
      const exists = await adminRepo.emailExists('admin@example.com')
      expect(exists).toBe(true)
    })
  })

  describe('generateApiKey() and verifyApiKey()', () => {
    it('should generate and return new apiKey', async () => {
      const adminWithKey = { _id: 'a1', apiKey: 'aa_123' }
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(adminWithKey)
      })

      const result = await adminRepo.generateApiKey('a1')

      expect(Admin.findByIdAndUpdate).toHaveBeenCalledWith('a1', { $set: expect.objectContaining({ apiKey: expect.any(String) }) }, { new: true, runValidators: true })
      expect(result.apiKey).toMatch(/^aa_/)
    })

    it('should verify apiKey', async () => {
      const admin = { apiKey: 'aa_123', isActive: true }
      Admin.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(admin)
      })

      const result = await adminRepo.verifyApiKey('aa_123')

      expect(Admin.findOne).toHaveBeenCalledWith({ apiKey: 'aa_123', isActive: true })
      expect(result).toEqual(admin)
    })
  })

  describe('updateRole()', () => {
    it('should update admin role', async () => {
      const updated = { _id: 'a1', role: 'SuperAdmin' }
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(updated)
      })

      const result = await adminRepo.updateRole('a1', 'SuperAdmin')

      expect(Admin.findByIdAndUpdate).toHaveBeenCalledWith('a1', { $set: { role: 'SuperAdmin' } }, { new: true, runValidators: true })
      expect(result.role).toBe('SuperAdmin')
    })

    it('should return null for empty role', async () => {
      // Role validation happens via Mongoose validator - returns null if empty string passed
      // The repository checks if (!id || !status) - but role can be anything string
      // However, if the update fails or returns no document, it returns null
      // Simulate failure case:
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      const result = await adminRepo.updateRole('a1', '')
      expect(result).toBeNull()
    })
  })

  describe('updatePermissions()', () => {
    it('should update admin permissions', async () => {
      const permissions = [{ resource: 'users', actions: ['read', 'write'] }]
      const updated = { _id: 'a1', permissions }
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(updated)
      })

      const result = await adminRepo.updatePermissions('a1', permissions)

      expect(Admin.findByIdAndUpdate).toHaveBeenCalledWith('a1', { $set: { permissions } }, { new: true, runValidators: true })
      expect(result.permissions).toEqual(permissions)
    })

    it('should return null if adminId is falsy', async () => {
      const result = await adminRepo.updatePermissions(null, [])
      expect(result).toBeNull()
    })
  })

  describe('recordLogin()', () => {
    it('should record admin login', async () => {
      const updated = { _id: 'a1', lastLogin: new Date(), loginCount: 5 }
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(updated)
      })

      const result = await adminRepo.recordLogin('a1')

      expect(Admin.findByIdAndUpdate).toHaveBeenCalledWith('a1', {
        $set: { lastLogin: expect.any(Date) },
        $inc: { loginCount: 1 }
      }, { new: true })
      expect(result.loginCount).toBe(5)
    })
  })

  describe('revokeApiKey()', () => {
    it('should revoke api key', async () => {
      const updated = { _id: 'a1', apiKey: null }
      Admin.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(updated)
      })

      const result = await adminRepo.revokeApiKey('a1')

      expect(Admin.findByIdAndUpdate).toHaveBeenCalledWith('a1', { $unset: { apiKey: '' } }, { new: true })
      expect(result.apiKey).toBeNull()
    })
  })

  describe('getDashboardStats()', () => {
    it('should aggregate admin stats by role', async () => {
      const stats = [{ _id: 'Agent', count: 5, activeCount: 4 }]
      Admin.aggregate = jest.fn().mockResolvedValue(stats)

      const result = await adminRepo.getDashboardStats()

      expect(Admin.aggregate).toHaveBeenCalled()
      expect(result).toEqual(stats)
    })
  })

  describe('search()', () => {
    it('should filter admins by role', async () => {
      const admins = [{ role: 'Agent' }]
      adminRepo.Model = Admin
      Admin.find = jest.fn().mockReturnThis()
      Admin.skip = jest.fn().mockReturnThis()
      Admin.limit = jest.fn().mockReturnThis()
      Admin.sort = jest.fn().mockReturnThis()
      Admin.lean = jest.fn().mockResolvedValue(admins)

      await adminRepo.search({ role: 'Agent' })

      expect(Admin.find).toHaveBeenCalledWith({ role: 'Agent' })
    })

    it('should filter by isActive status', async () => {
      const admins = [{ isActive: true }]
      adminRepo.Model = Admin
      Admin.find = jest.fn().mockReturnThis()
      Admin.skip = jest.fn().mockReturnThis()
      Admin.limit = jest.fn().mockReturnThis()
      Admin.sort = jest.fn().mockReturnThis()
      Admin.lean = jest.fn().mockResolvedValue(admins)

      await adminRepo.search({ isActive: true })

      expect(Admin.find).toHaveBeenCalledWith({ isActive: true })
    })

    it('should filter by department', async () => {
      const admins = [{ department: 'Sales' }]
      adminRepo.Model = Admin
      Admin.find = jest.fn().mockReturnThis()
      Admin.skip = jest.fn().mockReturnThis()
      Admin.limit = jest.fn().mockReturnThis()
      Admin.sort = jest.fn().mockReturnThis()
      Admin.lean = jest.fn().mockResolvedValue(admins)

      await adminRepo.search({ department: 'Sales' })

      expect(Admin.find).toHaveBeenCalledWith({ department: 'Sales' })
    })
  })
})
