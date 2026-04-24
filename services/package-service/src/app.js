if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config()
}

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const Config = require('@travel-agency/shared-config')
const { AppError } = require('@travel-agency/shared-errors')

const database = require('./utils/database')
const packageRouter = require('./routes/package.routes')

const app = express()
const config = Config.get('package-service')

app.use(helmet())
app.use(cors(config.server?.cors || { origin: '*', credentials: false }))
app.use(express.json())

if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests from this IP, please try again later.'
  })
  app.use('/api/', limiter)
}

app.get('/health', async (req, res) => {
  const dbStatus = database.isConnected() ? 'connected' : 'disconnected'
  const statusCode = dbStatus === 'connected' ? 200 : 503

  res.status(statusCode).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'package-service',
    database: dbStatus
  })
})

app.use('/api/packages', packageRouter)

app.use('*', (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404))
})

app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500
  const message = err.message || 'Internal server error'

  console.error(`[package-service] ${req.method} ${req.path}`, err)

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
})

async function startServer() {
  try {
    await database.connect(config.mongodb.url, config.mongodb.database)

    const port = config.port || 3002
    app.listen(port, () => {
      console.log(`package-service listening on port ${port}`)
    })
  } catch (error) {
    console.error('[package-service] failed to start', error)
    process.exit(1)
  }
}

if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer()
}

module.exports = app
