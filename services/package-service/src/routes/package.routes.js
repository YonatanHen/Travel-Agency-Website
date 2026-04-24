const express = require('express')
const PackageRepository = require('../repositories/PackageRepository')
const PackageService = require('../services/PackageService')
const { authenticateJWT, authorizeRole } = require('../middleware/auth')

const router = express.Router()

const packageRepository = new PackageRepository()
const packageService = new PackageService(packageRepository)

router.get('/', async (req, res, next) => {
  try {
    const result = await packageService.listPackages(req.query)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
})

router.get('/destination/:name', async (req, res, next) => {
  try {
    const packages = await packageService.findByDestination(req.params.name, req.query)
    res.status(200).json(packages)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const pkg = await packageService.getPackageById(req.params.id)
    res.status(200).json(pkg)
  } catch (error) {
    next(error)
  }
})

router.post('/', authenticateJWT, authorizeRole('Admin'), async (req, res, next) => {
  try {
    const created = await packageService.createPackage(req.body)
    res.status(201).json(created)
  } catch (error) {
    next(error)
  }
})

router.put('/:id', authenticateJWT, authorizeRole('Admin'), async (req, res, next) => {
  try {
    const updated = await packageService.updatePackage(req.params.id, req.body)
    res.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', authenticateJWT, authorizeRole('Admin'), async (req, res, next) => {
  try {
    const deleted = await packageService.deletePackage(req.params.id)
    res.status(200).json(deleted)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/rating', authenticateJWT, async (req, res, next) => {
  try {
    const updated = await packageService.addRating(req.params.id, req.body.rating)
    res.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/quantity/increment', authenticateJWT, authorizeRole('Admin', 'Agent'), async (req, res, next) => {
  try {
    const updated = await packageService.incrementQuantity(
      req.params.id,
      req.body.amount || 1
    )
    res.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/quantity/decrement', authenticateJWT, authorizeRole('Admin', 'Agent'), async (req, res, next) => {
  try {
    const updated = await packageService.decrementQuantity(
      req.params.id,
      req.body.amount || 1
    )
    res.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

module.exports = router
