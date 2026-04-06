const BaseRepository = require('@travel-agency/shared-repositories')
const Message = require('../models/Message')

/**
 * MessageRepository - manages contact form messages and admin communications.
 */
class MessageRepository extends BaseRepository {
  constructor() {
    super(Message)
  }

  /**
   * Find unread messages
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findUnread(options = {}) {
    return await this.find(
      { isRead: false, 'metadata.isSpam': { $ne: true } },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Find messages by priority
   * @param {string} priority
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByPriority(priority, options = {}) {
    return await this.find(
      { priority, 'metadata.isSpam': { $ne: true } },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Find messages by user ID (for user's support history)
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    if (!userId) return []
    return await this.find(
      { userId, 'metadata.isSpam': { $ne: true } },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Find messages by email
   * @param {string} email
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async findByEmail(email, options = {}) {
    return await this.find(
      { email: email.toLowerCase(), 'metadata.isSpam': { $ne: true } },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Search messages by subject or content
   * @param {string} searchTerm
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    if (!searchTerm) return []
    const regex = new RegExp(searchTerm, 'i')
    return await this.find(
      {
        $or: [
          { subject: regex },
          { message: regex },
          { name: regex }
        ],
        'metadata.isSpam': { $ne: true }
      },
      { ...options, sort: { createdAt: -1 } }
    )
  }

  /**
   * Get unread count
   * @returns {Promise<number>}
   */
  async getUnreadCount() {
    return await this.Model.countDocuments({
      isRead: false,
      'metadata.isSpam': { $ne: true }
    })
  }

  /**
   * Get message statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return await this.Model.aggregate([
      {
        $match: { 'metadata.isSpam': { $ne: true } }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          avgDaysUnread: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      }
    ])
  }

  /**
   * Mark message as read
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async markAsRead(id) {
    if (!id) return null
    return await this.Model.findByIdAndUpdate(
      id,
      { $set: { isRead: true, updatedAt: new Date() } },
      { new: true }
    ).lean()
  }

  /**
   * Mark message as replied
   * @param {string} id
   * @param {string} adminName
   * @returns {Promise<Object|null>}
   */
  async markAsReplied(id, adminName) {
    if (!id) return null
    return await this.Model.findByIdAndUpdate(
      id,
      {
        $set: {
          repliedAt: new Date(),
          repliedBy: adminName
        }
      },
      { new: true }
    ).lean()
  }

  /**
   * Check if message is spam (simple keyword filtering)
   * @param {string} subject
   * @param {string} message
   * @param {string} email
   * @returns {Promise<Object>} { isSpam: boolean, score: number, reasons: [] }
   */
  async checkSpam(subject, message, email) {
    const spamKeywords = [
      'free money', 'lottery winner', 'urgent action required',
      'prince of nigeria', 'reset your password', 'click here',
      'buy now', 'limited time offer', 'make money fast'
    ]

    const text = (subject + ' ' + message).toLowerCase()
    const emailDomain = email.split('@')[1]

    const knownSpamDomains = ['spamdomain.com', 'tempmail.org', '10minutemail.com']
    const disposableDomains = ['guerrillamail.com', 'mailinator.com']

    let score = 0
    const reasons = []

    // Check spam keywords
    spamKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        score += 20
        reasons.push(`Contains spam keyword: ${keyword}`)
      }
    })

    // Check disposable email domains
    if (disposableDomains.includes(emailDomain)) {
      score += 30
      reasons.push(`Disposable email domain: ${emailDomain}`)
    }

    // Check known spam domains
    if (knownSpamDomains.includes(emailDomain)) {
      score += 50
      reasons.push(`Known spam domain: ${emailDomain}`)
    }

    // Check for ALL CAPS subject
    if (subject.length > 10 && subject === subject.toUpperCase()) {
      score += 15
      reasons.push('Subject is all caps')
    }

    // Check for excessive links
    const linkCount = (message.match(/https?:\/\/[^\s]+/g) || []).length
    if (linkCount > 3) {
      score += 25
      reasons.push(`Excessive links: ${linkCount}`)
    }

    const isSpam = score >= 50

    return { isSpam, score, reasons }
  }
}

module.exports = MessageRepository
