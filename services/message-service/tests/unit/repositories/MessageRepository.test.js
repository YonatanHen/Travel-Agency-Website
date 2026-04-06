const MessageRepository = require('../../../src/repositories/MessageRepository')
const Message = require('../../../src/models/Message')

jest.mock('../../../src/models/Message')

describe('MessageRepository', () => {
  let msgRepo

  beforeEach(() => {
    jest.resetAllMocks()
    msgRepo = new MessageRepository()
  })

  describe('findUnread()', () => {
    it('should find unread non-spam messages', async () => {
      const messages = [{ isRead: false }]
      Message.find = jest.fn().mockReturnThis()
      Message.skip = jest.fn().mockReturnThis()
      Message.limit = jest.fn().mockReturnThis()
      Message.sort = jest.fn().mockReturnThis()
      Message.lean = jest.fn().mockResolvedValue(messages)

      await msgRepo.findUnread()

      // find() called with query only; options via chaining
      expect(Message.find).toHaveBeenCalledWith({ isRead: false, 'metadata.isSpam': { $ne: true } })
    })
  })

  describe('getUnreadCount()', () => {
    it('should count unread non-spam messages', async () => {
      Message.countDocuments = jest.fn().mockResolvedValue(5)
      const count = await msgRepo.getUnreadCount()
      expect(count).toBe(5)
    })
  })

  describe('markAsRead() and markAsReplied()', () => {
    it('should mark message as read', async () => {
      const updated = { _id: 'm1', isRead: true }
      Message.findByIdAndUpdate = jest.fn().mockReturnThis()
      Message.lean = jest.fn().mockResolvedValue(updated)

      const result = await msgRepo.markAsRead('m1')

      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith('m1', { $set: { isRead: true, updatedAt: expect.anything() } }, { new: true })
      expect(result.isRead).toBe(true)
    })

    it('should mark message as replied', async () => {
      const updated = { _id: 'm1', repliedAt: new Date(), repliedBy: 'Admin1' }
      Message.findByIdAndUpdate = jest.fn().mockReturnThis()
      Message.lean = jest.fn().mockResolvedValue(updated)

      const result = await msgRepo.markAsReplied('m1', 'Admin1')

      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith('m1', { $set: { repliedAt: expect.anything(), repliedBy: 'Admin1' } }, { new: true })
      expect(result.repliedBy).toBe('Admin1')
    })
  })

  describe('checkSpam()', () => {
    it('should flag spam based on keywords and domains', async () => {
      // This method call does not use mongoose; it's pure logic
      const result = await msgRepo.checkSpam(
        'URGENT: Free money',
        'Click here to win lottery',
        'spammer@spamdomain.com'
      )

      expect(result.isSpam).toBe(true)
      expect(result.score).toBeGreaterThan(50)
      expect(result.reasons.length).toBeGreaterThan(0)
    })

    it('should not flag legitimate messages', async () => {
      const result = await msgRepo.checkSpam(
        'Booking inquiry',
        'I would like to book a package',
        'customer@gmail.com'
      )

      expect(result.isSpam).toBe(false)
    })
  })

  describe('search()', () => {
    it('should search messages by subject/content/name', async () => {
      const messages = [{ subject: 'Booking' }]
      Message.find = jest.fn().mockReturnThis()
      Message.skip = jest.fn().mockReturnThis()
      Message.limit = jest.fn().mockReturnThis()
      Message.sort = jest.fn().mockReturnThis()
      Message.lean = jest.fn().mockResolvedValue(messages)

      await msgRepo.search('Booking')

      // find() called with query only; options via chaining
      expect(Message.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array),
          'metadata.isSpam': { $ne: true }
        })
      )
    })
  })
})
