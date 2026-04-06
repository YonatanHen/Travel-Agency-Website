const CustomerRepository = require('../../../src/repositories/CustomerRepository')
const Customer = require('../../../src/models/Customer')

jest.mock('../../../src/models/Customer')

describe('CustomerRepository', () => {
  let custRepo

  beforeEach(() => {
    jest.resetAllMocks()
    custRepo = new CustomerRepository()
  })

  describe('findByUserId()', () => {
    it('should find customer by userId', async () => {
      const customer = { userId: 'u123', username: 'john' }
      Customer.findOne = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(customer)

      const result = await custRepo.findByUserId('u123')

      expect(Customer.findOne).toHaveBeenCalledWith({ userId: 'u123' })
      expect(result).toEqual(customer)
    })

    it('should return null if not found', async () => {
      Customer.findOne = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(null)
      const result = await custRepo.findByUserId('none')
      expect(result).toBeNull()
    })
  })

  describe('findByTier()', () => {
    it('should find customers by loyalty tier', async () => {
      const customers = [{ loyaltyTier: 'Gold' }]
      custRepo.Model = Customer
      Customer.find = jest.fn().mockReturnThis()
      Customer.skip = jest.fn().mockReturnThis()
      Customer.limit = jest.fn().mockReturnThis()
      Customer.sort = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(customers)

      await custRepo.findByTier('Gold')

      // find() called with query only; options via chaining
      expect(Customer.find).toHaveBeenCalledWith({ loyaltyTier: 'Gold' })
    })
  })

  describe('recordBooking()', () => {
    it('should update customer booking stats and points', async () => {
      const updated = { userId: 'u1', totalBookings: 2, totalSpent: 300, loyaltyPoints: 3 }
      Customer.findOneAndUpdate = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(updated)

      const result = await custRepo.recordBooking('u1', 200)

      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'u1' },
        expect.objectContaining({
          $inc: expect.objectContaining({
            totalBookings: 1,
            totalSpent: 200,
            loyaltyPoints: 2
          })
        }),
        expect.anything()
      )
      expect(result.totalBookings).toBe(2)
    })
  })

  describe('getDiscountedPrice()', () => {
    it('should apply loyalty discount based on tier', async () => {
      const customer = { loyaltyTier: 'Gold' }
      Customer.findOne = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(customer)

      const discounted = await custRepo.getDiscountedPrice('u1', 1000)

      expect(discounted).toBe(900) // 10% discount
    })

    it('should return base amount if no customer found', async () => {
      Customer.findOne = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(null)
      const price = await custRepo.getDiscountedPrice('u1', 1000)
      expect(price).toBe(1000)
    })
  })

  describe('deactivate()', () => {
    it('should deactivate customer', async () => {
      const deactivated = { userId: 'u1', isActive: false }
      Customer.findOneAndUpdate = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(deactivated)

      const result = await custRepo.deactivate('u1')

      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith({ userId: 'u1' }, { $set: { isActive: false } }, { new: true })
      expect(result.isActive).toBe(false)
    })
  })

  describe('updateProfile()', () => {
    it('should update allowed profile fields', async () => {
      const updated = { userId: 'u1', phone: '123-456-7890', address: { city: 'NYC' } }
      Customer.findOneAndUpdate = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue(updated)

      const result = await custRepo.updateProfile('u1', {
        phone: '123-456-7890',
        address: { city: 'NYC' },
        // disallowed: totalSpent
        totalSpent: 9999
      })

      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'u1' },
        { $set: { phone: '123-456-7890', address: { city: 'NYC' } } },
        { new: true, runValidators: true }
      )
      expect(result.phone).toBe('123-456-7890')
    })

    it('should ignore disallowed fields and return null', async () => {
      Customer.findOneAndUpdate = jest.fn().mockReturnThis()
      Customer.lean = jest.fn().mockResolvedValue({})

      const result = await custRepo.updateProfile('u1', { totalSpent: 9999, loyaltyTier: 'Platinum' })

      // No allowed fields, so should not call DB and return null
      expect(Customer.findOneAndUpdate).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should return null if no allowed fields', async () => {
      const result = await custRepo.updateProfile('u1', { invalid: 'field' })
      expect(result).toBeNull()
    })
  })
})
