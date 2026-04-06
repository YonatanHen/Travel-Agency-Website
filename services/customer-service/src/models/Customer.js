const mongoose = require('mongoose')

const CustomerSchema = new mongoose.Schema({
  // Links to user in User Service (store as ObjectId string)
  userId: {
    type: String,  // ObjectId as string (user-service owns this ID)
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  preferences: {
    dietaryRestrictions: [String],
    accessibilityNeeds: [String],
    interests: [String],
    newsletterSubscribed: {
      type: Boolean,
      default: true
    }
  },
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  loyaltyTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  lastBookingDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
CustomerSchema.index({ email: 1 })
CustomerSchema.index({ username: 1 })
CustomerSchema.index({ loyaltyTier: 1 })
CustomerSchema.index({ totalSpent: -1 })
CustomerSchema.index({ isActive: 1 })

// Virtual: customer segment based on spending/tier
CustomerSchema.virtual('segment').get(function() {
  if (this.loyaltyTier === 'Platinum' || this.loyaltyTier === 'Gold') {
    return 'VIP'
  }
  if (this.totalSpent > 5000) {
    return 'Premium'
  }
  if (this.totalBookings >= 5) {
    return 'Loyal'
  }
  return 'Standard'
})

// Method: add loyalty points
CustomerSchema.methods.addPoints = function(points) {
  if (points <= 0) return this
  this.loyaltyPoints += points

  // Update tier based on points
  if (this.loyaltyPoints >= 10000) {
    this.loyaltyTier = 'Platinum'
  } else if (this.loyaltyPoints >= 5000) {
    this.loyaltyTier = 'Gold'
  } else if (this.loyaltyPoints >= 2000) {
    this.loyaltyTier = 'Silver'
  } else {
    this.loyaltyTier = 'Bronze'
  }

  return this
}

// Method: increment booking count and update last booking date
CustomerSchema.methods.recordBooking = function(orderTotal) {
  this.totalBookings += 1
  this.totalSpent += orderTotal
  this.lastBookingDate = new Date()
  return this
}

module.exports = mongoose.model('Customer', CustomerSchema)
