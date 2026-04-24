const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();

// Service registry for discovery
const services = {
  'user-service': {
    url: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    healthCheck: '/health',
    instances: [process.env.USER_SERVICE_INSTANCE || 'localhost:3002']
  },
  // Add other services as they are created
};

// Health check for services
async function checkServiceHealth(serviceName) {
  const service = services[serviceName];
  if (!service) return false;

  try {
    const response = await fetch(`${service.url}${service.healthCheck}`);
    return response.ok;
  } catch (error) {
    console.error(`Health check failed for ${serviceName}:`, error.message);
    return false;
  }
}

// Service discovery
function getServiceUrl(serviceName) {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Service ${serviceName} not found`);
  }

  // Simple round-robin load balancing
  const instance = service.instances[0]; // In production, implement proper load balancing
  return `${service.url}`;
}

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP
  message: 'Too many requests from this IP'
});

app.use(globalLimiter);

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Proxy middleware with authentication
function createServiceProxy(serviceName) {
  return createProxyMiddleware({
    target: getServiceUrl(serviceName),
    changeOrigin: true,
    pathRewrite: {
      [`^/${serviceName}`]: '' // Remove service name from path
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add authentication headers if needed
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
      }
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${serviceName}:`, err);
      res.status(502).json({ error: 'Service unavailable' });
    }
  });
}

// Routes for each service
app.use('/api/user', authenticateToken, createServiceProxy('user-service'));
// Add other service routes as they are created:
// app.use('/api/package', authenticateToken, createServiceProxy('package-service'));
// app.use('/api/order', authenticateToken, createServiceProxy('order-service'));

// Health check
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    gateway: 'api-gateway',
    services: {}
  };

  // Check all services
  for (const serviceName of Object.keys(services)) {
    healthStatus.services[serviceName] = await checkServiceHealth(serviceName);
  }

  const allHealthy = Object.values(healthStatus.services).every(status => status);
  res.status(allHealthy ? 200 : 503).json(healthStatus);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({ error: 'Internal gateway error' });
});

const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

module.exports = app;