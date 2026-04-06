const mongoose = require('mongoose')

const PackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Package name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  destination: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true
  },
  duration: {
    type: Number,  // in days
    required: true,
    min: [1, 'Duration must be at least 1 day']
  },
  imageUrl: {
    type: String,
    match: [/^https?:\/\/[^\s]+$/, 'Invalid URL format']
  },
  amenities: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
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
PackageSchema.index({ name: 1 })
PackageSchema.index({ destination: 1 })
PackageSchema.index({ rating: -1 })
PackageSchema.index({ price: 1 })
PackageSchema.index({ isActive: 1 })
PackageSchema.index({ createdAt: -1 })

// Method to update rating (average calculation)
PackageSchema.methods.updateRating = async function(newRating) {
  const currentTotal = this.rating * this.reviewCount
  const newCount = this.reviewCount + 1
  const newAverage = (currentTotal + newRating) / newCount

  this.rating = Math.round(newAverage * 10) / 10
  this.reviewCount = newCount
  await this.save()
  return this.rating
}

module.exports = mongoose.model('Package', PackageSchema)
