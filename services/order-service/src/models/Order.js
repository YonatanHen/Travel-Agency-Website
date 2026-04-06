const mongoose = require('mongoose')

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Should reference user-service DB if cross-db (will use ObjectId string)
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',  // Should reference package-service DB
    required: true,
    index: true
  },
  packageName: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  travelDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Canceled'],
    default: 'Pending',
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  customerNotes: {
    type: String,
    trim: true
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  canceledAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Compound indexes for common queries
OrderSchema.index({ user: 1, createdAt: -1 })
OrderSchema.index({ status: 1, createdAt: -1 })
OrderSchema.index({ package: 1, status: 1 })
OrderSchema.index({ travelDate: 1 })

// Virtual for checking if order is pending
OrderSchema.virtual('isPending').get(function() {
  return this.status === 'Pending'
})

OrderSchema.virtual('isConfirmed').get(function() {
  return this.status === 'Confirmed'
})

OrderSchema.virtual('isCanceled').get(function() {
  return this.status === 'Canceled'
})

module.exports = mongoose.model('Order', OrderSchema)
