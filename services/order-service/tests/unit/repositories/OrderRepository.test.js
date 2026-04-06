const OrderRepository = require('../../../src/repositories/OrderRepository')
const Order = require('../../../src/models/Order')

jest.mock('../../../src/models/Order')

describe('OrderRepository', () => {
  let orderRepo

  beforeEach(() => {
    jest.resetAllMocks()
    orderRepo = new OrderRepository()
  })

  describe('findByUser()', () => {
    it('should find orders by user ID with recent first', async () => {
      const orders = [{ user: 'u1' }]
      Order.find = jest.fn().mockReturnThis()
      Order.skip = jest.fn().mockReturnThis()
      Order.limit = jest.fn().mockReturnThis()
      Order.sort = jest.fn().mockReturnThis()
      Order.lean = jest.fn().mockResolvedValue(orders)

      await orderRepo.findByUser('u1')

      // find() called with query only; options via chaining
      expect(Order.find).toHaveBeenCalledWith({ user: 'u1' })
      // Verify sort applied
      expect(Order.sort).toHaveBeenCalledWith({ createdAt: -1 })
    })
  })

  describe('findByStatus()', () => {
    it('should find orders by status', async () => {
      Order.find = jest.fn().mockReturnThis()
      Order.skip = jest.fn().mockReturnThis()
      Order.limit = jest.fn().mockReturnThis()
      Order.sort = jest.fn().mockReturnThis()
      Order.lean = jest.fn().mockResolvedValue([])

      await orderRepo.findByStatus('Confirmed')

      expect(Order.find).toHaveBeenCalledWith({ status: 'Confirmed' })
    })
  })

  describe('cancel()', () => {
    it('should cancel an order', async () => {
      const canceled = { _id: 'o1', status: 'Canceled', cancellationReason: 'changed mind' }
      Order.findByIdAndUpdate = jest.fn().mockReturnThis()
      Order.lean = jest.fn().mockResolvedValue(canceled)

      const result = await orderRepo.cancel('o1', 'changed mind')

      expect(Order.findByIdAndUpdate).toHaveBeenCalledWith('o1', { $set: { status: 'Canceled', cancellationReason: 'changed mind', canceledAt: expect.anything() } }, { new: true, runValidators: true })
      expect(result.status).toBe('Canceled')
    })
  })

  describe('updateStatus()', () => {
    it('should update order status', async () => {
      const updated = { _id: 'o1', status: 'Confirmed' }
      Order.findByIdAndUpdate.mockReturnThis()
      Order.lean = jest.fn().mockResolvedValue(updated)

      const result = await orderRepo.updateStatus('o1', 'Confirmed')

      expect(Order.findByIdAndUpdate).toHaveBeenCalledWith('o1', { $set: { status: 'Confirmed', updatedAt: expect.anything() } }, { new: true, runValidators: true })
      expect(result.status).toBe('Confirmed')
    })

    it('should return null for invalid ID', async () => {
      const result = await orderRepo.updateStatus(null, 'Pending')
      expect(result).toBeNull()
    })
  })

  describe('belongsToUser()', () => {
    it('should return true if order belongs to user', async () => {
      Order.exists = jest.fn().mockResolvedValue(true)
      const belongs = await orderRepo.belongsToUser('o1', 'u1')
      expect(belongs).toBe(true)
      expect(Order.exists).toHaveBeenCalledWith({ _id: 'o1', user: 'u1' })
    })

    it('should return false if order does not belong to user', async () => {
      Order.exists = jest.fn().mockResolvedValue(null)
      const belongs = await orderRepo.belongsToUser('o1', 'u2')
      expect(belongs).toBe(false)
    })
  })

  describe('getStats()', () => {
    it('should aggregate order statistics by status', async () => {
      const stats = [{ _id: 'Confirmed', count: 5, totalRevenue: 5000 }]
      Order.aggregate = jest.fn().mockResolvedValue(stats)

      const result = await orderRepo.getStats()

      expect(Order.aggregate).toHaveBeenCalled()
      expect(result).toEqual(stats)
    })
  })
})
