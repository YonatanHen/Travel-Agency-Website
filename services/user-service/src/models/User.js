const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: ['Customer', 'Agent', 'Admin'],
    default: 'Customer',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,  // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for better query performance
UserSchema.index({ email: 1 })
UserSchema.index({ username: 1 })
UserSchema.index({ role: 1 })
UserSchema.index({ createdAt: -1 })

// Virtual for checking if user is admin
UserSchema.virtual('isAdmin').get(function() {
  return this.role === 'Admin'
})

// Method to compare password (business logic in entity - okay)
UserSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs')
  return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', UserSchema)
