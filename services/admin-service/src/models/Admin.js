const mongoose = require('mongoose')

const AdminSchema = new mongoose.Schema({
  // Reference to user (should link to user-service DB)
  userId: {
    type: String,
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
  role: {
    type: String,
    enum: ['Agent', 'Admin', 'SuperAdmin'],
    default: 'Agent',
    required: true,
    index: true
  },
  department: {
    type: String,
    enum: ['Customer Service', 'Sales', 'Operations', 'Finance', 'Marketing'],
    trim: true
  },
  permissions: [{
    resource: String,
    actions: [String]  // ['read', 'write', 'delete']
  }],
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
AdminSchema.index({ email: 1 })
AdminSchema.index({ username: 1 })
AdminSchema.index({ role: 1 })
AdminSchema.index({ isActive: 1 })
AdminSchema.index({ 'permissions.resource': 1 })

// Virtual: check if super admin
AdminSchema.virtual('isSuperAdmin').get(function() {
  return this.role === 'SuperAdmin'
})

// Virtual: check if admin
AdminSchema.virtual('isAdmin').get(function() {
  return this.role === 'Admin' || this.isSuperAdmin
})

// Method: check permission
AdminSchema.methods.hasPermission = function(resource, action) {
  if (this.isSuperAdmin) return true

  const permission = this.permissions.find(
    p => p.resource === resource && p.actions.includes(action)
  )
  return !!permission
}

// Method: grant permission
AdminSchema.methods.grantPermission = function(resource, action) {
  let permission = this.permissions.find(p => p.resource === resource)
  if (!permission) {
    permission = { resource, actions: [] }
    this.permissions.push(permission)
  }
  if (!permission.actions.includes(action)) {
    permission.actions.push(action)
  }
  return this
}

// Method: revoke permission
AdminSchema.methods.revokePermission = function(resource, action) {
  const permission = this.permissions.find(p => p.resource === resource)
  if (permission) {
    permission.actions = permission.actions.filter(a => a !== action)
    if (permission.actions.length === 0) {
      this.permissions = this.permissions.filter(p => p.resource !== resource)
    }
  }
  return this
}

// Method: record login
AdminSchema.methods.recordLogin = function() {
  this.lastLogin = new Date()
  this.loginCount += 1
  return this
}

module.exports = mongoose.model('Admin', AdminSchema)
