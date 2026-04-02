---
name: docker-k8s
description: Write production-ready Dockerfiles and Kubernetes manifests. Use multi-stage builds, non-root users, health checks, resource limits, and Docker Compose for local development. Follow security best practices (minimal images, no secrets in layers).
---

## Dockerfile Pattern (All Services)

Use multi-stage build for smaller images:

```dockerfile
# Stage 1: Install dependencies
FROM node:18-alpine AS builder
WORKDIR /app

# Copy only package files first (caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Runtime image
FROM node:18-alpine
WORKDIR /app

# Copy from builder (smaller, no dev deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy application code as non-root user
COPY --chown=node:node . .

# Switch to non-root user
USER node

# Expose port (match service PORT)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { if(r.statusCode!==200) throw new Error(r.statusCode) })"

# Start command
CMD ["node", "src/index.js"]
```

**Important:**
- Base image: `node:18-alpine` (small, ~50MB)
- Run as non-root: `USER node`
- Health check endpoint required
- Copy with `--chown=node:node` for ownership
- Production-only dependencies (`--only=production`)

## docker-compose.yml

Single docker-compose.yml at project root orchestrates all services:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    container_name: travel-agency-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"  # Expose for local dev tools
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  user-service:
    build:
      context: ./services/user-service
      dockerfile: Dockerfile
    container_name: travel-agency-user-service
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017
      - DATABASE_NAME=travel_agency_users
      - JWT_SECRET=dev-secret-change-in-production
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (r) => { if(r.statusCode!==200) throw new Error(r.statusCode) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Repeat for package-service, order-service, customer-service, communication-service

  gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: travel-agency-gateway
    restart: unless-stopped
    ports:
      - "3000:3000"  # Frontend proxy target
    environment:
      - NODE_ENV=development
      - PORT=3000
      - USER_SERVICE_URL=http://user-service:3001
      - PACKAGE_SERVICE_URL=http://package-service:3002
      - ORDER_SERVICE_URL=http://order-service:3003
      - CUSTOMER_SERVICE_URL=http://customer-service:3004
      - COMMUNICATION_SERVICE_URL=http://communication-service:3005
    depends_on:
      - user-service
      - package-service
      - order-service
      - customer-service
      - communication-service
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongodb_data:
```

**Key points:**
- Use service names as hostnames (`mongodb`, `user-service`)
- \`depends_on\` with \`condition: service_healthy\` ensures DB ready
- Environment variables for each service's connection strings
- Named volume for MongoDB persistence
- Health checks on all services

## Health Check Endpoint

Every service must implement:

```javascript
app.get('/health', (req, res) => {
  // Basic check
  const health = {
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }

  // Optional: check DB connection
  if (mongoose.connection.readyState !== 1) {
    health.status = 'DOWN'
    health.database = 'disconnected'
  }

  const status = health.status === 'UP' ? 200 : 503
  res.status(status).json(health)
})
```

## Kubernetes Manifests (Production)

Place in `deployments/k8s/`.

### Service Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: travel-agency
    component: user-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: travel-agency
      component: user-service
  template:
    metadata:
      labels:
        app: travel-agency
        component: user-service
    spec:
      containers:
      - name: user-service
        image: yourusername/user-service:latest
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongo-secret
              key: uri
        - name: DATABASE_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: user-db-name
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: travel-agency
    component: user-service
  ports:
  - port: 3001
    targetPort: 3001
    protocol: TCP
  type: ClusterIP  # Internal only - gateway talks to it
```

### Ingress (Gateway exposed)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: travel-agency.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 3000
```

## Secrets and ConfigMaps

Externalize secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  jwt-secret: "your-actual-jwt-secret-here"
  sendgrid-api-key: "SG.xxxxx"
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  user-db-name: "travel_agency_users"
  package-db-name: "travel_agency_packages"
  gateway-port: "3000"
```

Secrets must be base64 encoded in actual manifests, but use `stringData` for readability in manifests, apply with kubectl.

## Docker Build Best Practices

- **Never** commit build artifacts into git (node_modules, dist)
- Use `.dockerignore`:
  ```
  node_modules
  npm-debug.log
  .git
  .env
  Dockerfile
  docker-compose.yml
  coverage
  test-results
  ```
- Pin base image versions: `node:18-alpine` (not `node:alpine`)
- Multi-stage reduces image size significantly
- Health checks are mandatory for orchestration
- Use `docker-compose build --no-cache` when Dockerfile changes

## Do NOT

- Run as root in containers
- Include devDependencies in production images
- Expose ports not needed (only the service port)
- Store secrets in Dockerfile (build args OK for non-sensitive, but use runtime env vars)
- Use latest tag in production (tag with Git SHA)
- Forget health checks
- Mount production volumes with wrong permissions
- Hardcode environment-specific values in Dockerfile (use env vars)
