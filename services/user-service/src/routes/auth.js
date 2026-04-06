const express = require('express')
const router = express.Router()
const UserService = require('../services/UserService')
const UserRepository = require('../repositories/UserRepository')
const { authenticateJWT } = require('../middleware/auth')

// Initialize service with repository (DI)
const userRepository = new UserRepository()
const userService = new UserService(userRepository)

/**
 * @route POST /api/auth/sign-up
 * @desc Register new user
 * @body { username, email, password, confirmPass, role? }
 * @returns 201 { id, username, email, role }
 * @throws 400 Validation error
 * @throws 409 Username or email already exists
 */
router.post('/sign-up', async (req, res, next) => {
  try {
    const user = await userService.registerUser(req.body)
    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
})

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get tokens
 * @body { username, password } (username can be email)
 * @returns 200 { token, refreshToken, user: { id, username, email, role } }
 * @throws 400 Missing credentials
 * @throws 401 Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const result = await userService.loginUser(username, password)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
})

/**
 * @route GET /api/auth/me
 * @desc Get current user profile (protected)
 * @header Authorization: Bearer <token>
 * @returns 200 { id, username, email, role }
 * @throws 401 No token / invalid token
 */
router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId)
    res.status(200).json(user)
  } catch (error) {
    next(error)
  }
})

module.exports = router
