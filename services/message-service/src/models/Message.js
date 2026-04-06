const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject too long']
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Normal', 'High', 'Urgent'],
    default: 'Normal',
    index: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  repliedAt: {
    type: Date
  },
  repliedBy: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    path: String,
    size: Number,
    mimeType: String
  }],
  // Optional: link to user if registered
  userId: {
    type: String,
    index: true
  },
  metadata: {
    // For spam detection, IP, user agent, etc.
    ip: String,
    userAgent: String,
    spamScore: {
      type: Number,
      default: 0
    },
    isSpam: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
MessageSchema.index({ email: 1 })
MessageSchema.index({ createdAt: -1 })
MessageSchema.index({ isRead: 1 })
MessageSchema.index({ priority: 1 })
MessageSchema.index({ userId: 1 })
MessageSchema.index({ 'metadata.isSpam': 1 })

// Virtual: days since sent
MessageSchema.virtual('daysSinceSent').get(function() {
  const diff = Date.now() - this.createdAt
  return Math.floor(diff / (1000 * 60 * 60 * 24))
})

// Virtual: check if message is unread
MessageSchema.virtual('isUnread').get(function() {
  return !this.isRead
})

// Method: mark as read
MessageSchema.methods.markAsRead = async function() {
  this.isRead = true
  await this.save()
  return this
}

// Method: mark as replied
MessageSchema.methods.markAsReplied = async function(adminName) {
  this.repliedAt = new Date()
  this.repliedBy = adminName
  await this.save()
  return this
}

// Method: flag as spam
MessageSchema.methods.flagSpam = async function(score) {
  this.metadata.isSpam = true
  this.metadata.spamScore = score || this.metadata.spamScore
  await this.save()
  return this
}

module.exports = mongoose.model('Message', MessageSchema)
