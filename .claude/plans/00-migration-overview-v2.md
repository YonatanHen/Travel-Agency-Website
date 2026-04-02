# Microservices Migration Plan - Master Overview

## Quick Navigation
- [Phase 0: Infrastructure](#phase-0-infrastructure)
- [Phase 1: Database Layer](#phase-1-database-layer)
- [Phase 2: Backend Services](#phase-2-backend-services)
- [Phase 3: API Gateway](#phase-3-api-gateway)
- [Phase 4: Frontend](#phase-4-frontend)
- [Phase 5: Shared Libraries](#phase-5-shared-libraries)
- [Phase 6: Testing](#phase-6-testing)
- [Phase 7: CI/CD](#phase-7-cicd)
- [Phase 8: Observability](#phase-8-observability)
- [Phase 9: Security](#phase-9-security)
- [Phase 10: Migration](#phase-10-migration)

---

## Current State Analysis

**Monolith**: Single Express app with 8 routers, 1 MongoDB database, mixed concerns
```bash
server/
├── app-source.js (central app)
├── routers/
│   ├── user.js        (auth, signup, login)
│   ├── admin.js       (role modification)
│   ├── package.js     (package CRUD, ratings)
│   ├── order.js       (order management)
│   ├── customers.js   (customer list)
│   ├── messages.js    (contact us, admin messages)
│   ├── email.js       (SendGrid integration)
│   └── agents-admins.js (list agents/admins)
└── database/
    └── mongoclient.js (global db connection)

Database: 7 collections in 1 DB (users, packages, orders, customers, messages, admins, agents)
```

**Problems**:
- Single database = tight coupling
- All code in one process = difficult to scale independently
- No service boundaries
- Mixed responsibilities in routes
- Hard to test/deploy individual features

---

## Target Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (1 database per microservice)
- **Message Queue**: **RabbitMQ** (for async communication - email notifications, order events)
- **Container**: Docker
- **Orchestration**: Kubernetes
- **API Gateway**: Express.js with routing, auth, rate limiting
- **Frontend**: React 17 (unchanged, but served independently)
- **CI/CD**: GitHub Actions
- **Testing**: Jest + Supertest

### Service Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                    │
│                   Port: 3008 (Docker) / served              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                            │
│              Port 3000 → Routes to services                 │
│  Auth • Rate Limiting • Logging • Health Checks • Proxy     │
└───────┬─────────────┬──────┬──────┬──────┬────┬─────────────┘
        │             │      │      │      │    │
        ▼             ▼      ▼      ▼      ▼    ▼
┌─────────────┐ ┌──────────┐ ┌──────────┐ ... ┌──────────┐
│   User      │ │ Package  │ │ Order    │     │  Email   │
│  Service    │ │ Service  │ │ Service  │     │ Service  │
│  :3001      │ │ :3002    │ │ :3003    │     │ :3006    │
│             │ │          │ │          │     │          │
│ DB: users   │ │DB: pkgs  │ │DB: orders│     │  (no DB) │
└─────────────┘ └──────────┘ └──────────┘     └──────────┘
        ▲             ▲      ▲
        │             │      │
        └─────────────┴──────┘ (service calls via HTTP)
                      │
                      ▼
            ┌─────────────────┐
            │    RABBITMQ     │
            │  Port: 5672     │
            │  Event Bus      │
            └─────────────────┘

Each Service → Own MongoDB Database (isolated)
```

### Event-Driven Communication with RabbitMQ

**Why RabbitMQ?**
- Decouples services (Order Service → Email Service)
- Async processing (send emails in background)
- Retry/Dead Letter Queue support
- Industry standard, great for portfolio

**Example flows**:
1. Order placed → publish `order.created` event → Email Service consumes → sends confirmation
2. Package updated → publish `package.updated` event → Admin dashboard can cache/invalidate
3. User registered → publish `user.created` → Email Service sends welcome

---

## Phase 0: Infrastructure Setup

### Plan 01: Create Monorepo & Docker Environment

**AI Context**: Establishes foundational directory structure, Docker containers, networking, and environment management before extracting any services. This is the scaffolding phase.

**What you get after completion**:
- Monorepo with `services/`, `gateway/`, `frontend/`, `shared/` directories
- docker-compose.yml with 6 MongoDB instances + RabbitMQ + placeholders
- Workspace configuration with Lerna
- Base Dockerfile template
- Environment templates per service

**Estimated effort**: 2-3 hours (infrastructure only, no service logic)

**Key decisions**:
- Monorepo with npm workspaces (easier for portfolio than separate repos)
- Docker Compose for dev (K8s manifests will be optional add-on)
- Separate MongoDB DBs per service (not separate containers - one container per service DB with different port)
- Internal port 3000 for all services, external host ports 3001-3007

**Baby Steps (see full plan for details)**:
- [01-01] Create directories: services/*, gateway/, frontend/ (move src/public)
- [01-02] Configure npm workspaces + Lerna in root package.json
- [01-03] Create Dockerfile.base, .dockerignore, docker-compose.yml with RabbitMQ
- [01-04] Create .env.example files for all services + setup script
- [01-05] Create shared config & error packages
- [01-06] Verify: Start MongoDB containers + RabbitMQ, check connectivity

**Output files**:
```
.
├── services/
│   ├── user-service/
│   ├── package-service/
│   ├── order-service/
│   ├── customer-service/
│   ├── message-service/
│   ├── email-service/
│   ├── admin-service/
│   └── (each has placeholder README, .env.example, package.json)
├── gateway/
│   ├── README.md
│   ├── .env.example
│   └── package.json
├── frontend/          (moved from src/ and public/)
│   ├── src/
│   ├── public/
│   └── Dockerfile
├── shared/
│   ├── config/
│   ├── errors/
│   └── package.json
├── docker-compose.yml
├── lerna.json
├── .env.example
└── .dockerignore
```

---

## Phase 1: Database Layer

### Plan 02: Database Schemas & Connections

**AI Context**: Define MongoDB schemas (Mongoose models) and connection utilities for each service. Each service owns its database entirely.

**What you get**:
- Mongoose schemas per service (user, package, order, customer, message, admin)
- Connection utility with DI pattern
- Database initialization scripts (indexes, seed data)
- Test database setup

**Note**: RabbitMQ doesn't need a database.

**Baby Steps**:
- [02-01] Define schemas with validation (see current monolith collections)
- [02-02] Create `BaseRepository` with connection logic
- [02-03] Implement repositories per service (UserRepository, etc.)
- [02-04] Create migration scripts if needed (unlikely since starting fresh)
- [02-05] Update docker-compose with volume mounts for MongoDB persistence

---

## Phase 2: Backend Microservices (7 services)

Extract each router from monolith into its own service with layered architecture:
```
service/
├── src/
│   ├── routes/          (HTTP layer, Express routers)
│   ├── services/        (Business logic)
│   ├── repositories/    (Data access - use BaseRepository)
│   ├── models/          (Mongoose schemas)
│   ├── middleware/      (Validation, auth, error handling)
│   ├── utils/           (Helpers)
│   └── app.js           (Express app setup)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── Dockerfile
├── package.json
└── .env
```

**Architecture Rules** (from CLAUDE.md):
- Routes → Services → Repositories → Models
- Never route → model directly
- Dependency injection everywhere
- Small functions (<30 lines), single responsibility
- Domain logic in services, not routes
- Repository pattern for data access

---

### Plan 03: User Service (Auth)

**Source**: `routers/user.js`

**Endpoints**:
```
POST   /api/users/sign-up      (register)
POST   /api/users/login        (authenticate)
GET    /api/users/:id          (get profile)
PUT    /api/users/:id/role     (admin: modify role)
GET    /api/users/validate     (check token validity)
```

**Extra for portfolio**:
- Password reset flow (email)
- JWT refresh tokens
- Rate limiting on login attempts
- Account lockout after 5 failed attempts

**Dependencies**: None (foundational)

**Database**: `users` collection

**Tests**: Signup validation, login success/failure, JWT generation, role modification

---

### Plan 04: Package Service

**Source**: `routers/package.js`

**Endpoints**:
```
GET    /api/packages                       (list all)
GET    /api/packages/:id                   (single package)
GET    /api/packages/destination/:name     (by destination name)
GET    /api/packages/rating/:min           (by rating threshold)
POST   /api/packages                       (create) - admin
PUT    /api/packages/:id                   (update) - admin
DELETE /api/packages/:id                   (delete) - admin
POST   /api/packages/:id/quantity/increment
POST   /api/packages/:id/quantity/decrement
POST   /api/packages/:id/rating            (rate package)
```

**Extra for portfolio**:
- Pagination (skip/limit)
- Filtering by price range, duration, amenities
- Search by text (name, description)
- Caching with Redis (optional, impressive)
- Image upload to S3/Cloudinary (optional)

**Dependencies**: None (independent)

**Database**: `packages` collection

**Tests**: All CRUD, validation (URL format), rating logic, quantity management

---

### Plan 05: Order Service

**Source**: `routers/order.js`

**Endpoints**:
```
GET    /api/orders                         (all orders - admin/agent)
GET    /api/orders/customer/:userId        (customer's orders)
POST   /api/orders                         (create order)
PUT    /api/orders/:id/status              (update status)
POST   /api/orders/:id/cancel              (cancel order)
DELETE /api/orders/:id                     (delete)
PUT    /api/orders/status/bulk             (bulk update - admin)
```

**Integration**: Should call Package Service to check availability before creating order!

**Events published to RabbitMQ**:
- `order.created` → Email Service sends confirmation
- `order.status.updated` → Email Service sends notification, Package Service increments/decrements quantity

**Extra for portfolio**:
- Saga pattern for order creation (1. Check package availability → 2. Reserve quantity → 3. Create order → 4. Send confirmation)
- Compensation actions if any step fails
- Order history with timestamps
- PDF invoice generation (optional)

**Dependencies**: Package Service (must call to validate/reserve packages)

**Database**: `orders` collection

**Tests**: Order creation with package validation, status updates, cancellation, RabbitMQ event publishing

---

### Plan 06: Customer Service

**Source**: `routers/customers.js`

**Notes**: Currently this is just a list of users with role 'Customer'. Should evolve into full customer management.

**Endpoints**:
```
GET    /api/customers                      (list all customers - admin/agent)
GET    /api/customers/:id                  (customer profile)
GET    /api/customers/:id/orders           (customer's orders - calls Order Service)
PUT    /api/customers/:id/profile          (update profile)
DELETE /api/customers/:id                  (delete account)
```

**Integration**: User Service (to get customer details), Order Service (for order history)

**Events published**:
- `customer.updated` (profile change)
- `customer.deleted` (anonymize orders?)

**Extra for portfolio**:
- Customer segmentation (new, returning, VIP)
- Customer preferences (dietary, accessibility)
- Loyalty points system

**Dependencies**: User Service (primary), Order Service (secondary)

**Database**: `customers` collection (could be view into users, or separate with subset)

**Tests**: Customer listing, profile management, integration with User Service

---

### Plan 07: Message Service

**Source**: `routers/messages.js`

**Endpoints**:
```
GET    /api/messages                       (all messages - admin)
GET    /api/messages/unread                (unread messages - admin)
POST   /api/messages/contact               (contact us form - public)
PUT    /api/messages/:id/read              (mark as read)
DELETE /api/messages/:id                   (delete)
```

**Events**:
- `message.received` → Email Service sends auto-response to customer, Admin gets notification

**Extra for portfolio**:
- Message threading
- Attachment support
- Spam detection (simple keyword filter)
- Auto-reply templates

**Dependencies**: None (independent)

**Database**: `messages` collection

**Tests**: CRUD operations, marking read, contact form validation

---

### Plan 08: Email Service

**Source**: `routers/email.js`

**Note**: Currently uses SendGrid. No database needed.

**Endpoints**:
```
POST   /api/email/send                     (send simple email)
POST   /api/email/send-to                  (custom recipient, subject, text)
POST   /api/email/broadcast                (send to multiple recipients)
POST   /api/email/order-confirmation       (with order details)
POST   /api/email/booking-notice           (upcoming trip reminder)
```

**Integration**: Called by other services via HTTP or RabbitMQ events

**Implementation**:
- RabbitMQ consumer for async events (order.created, message.received, user.created)
- SendGrid API integration
- Email templates (Handlebars/EJS)
- Rate limiting per service (to avoid abuse)

**Extra for portfolio**:
- Email queue (RabbitMQ) for reliability
- Retry logic with exponential backoff
- Dead letter queue for failed emails
- Email tracking (opens, clicks) via SendGrid webhooks
- Template management (DB or file-based)

**Dependencies**: SendGrid API, RabbitMQ (consume events)

**Database**: None, or optional `email_logs` for audit

**Tests**: SendGrid integration mock, event consumption, template rendering

---

### Plan 09: Admin Service

**Source**: `routers/admin.js`, `routers/agents-admins.js`

**Endpoints**:
```
GET    /api/admin/stats                    (dashboard: bookings, revenue, users)
GET    /api/admin/agents                   (list travel agents)
GET    /api/admin/admins                   (list admins)
POST   /api/admin/users/:id/role           (change user role)
GET    /api/admin/orders/report            (orders by date range)
GET    /api/admin/packages/metrics         (package performance)
GET    /api/admin/messages/recent          (recent contact messages)
```

**Integration**: User Service, Order Service, Package Service, Message Service

**Extra for portfolio**:
- Role hierarchy (SuperAdmin > Admin > Agent > Customer)
- Audit logging (who changed what)
- Report generation (CSV export)
- Dashboard caching (Redis)

**Dependencies**: All other services (aggregates data)

**Database**: `admins`, `agents` collections, or read from User Service with role filter

**Tests**: Stats calculation, role management, cross-service data aggregation

---

## Phase 3: API Gateway

### Plan 10: Gateway Service

**Purpose**: Single entry point, handles cross-cutting concerns.

**Responsibilities**:
1. **Routing**: Proxy `/api/users/*` → user-service:3001, etc.
2. **Authentication**: Validate JWT from User Service on protected routes
3. **Rate Limiting**: Per IP and per user
4. **Logging**: Centralized request logging with correlation IDs
5. **Error Handling**: Aggregate errors from services, format consistently
6. **Health Checks**: `/health` endpoint that checks all downstream services
7. **CORS**: Configure once for frontend
8. **Request ID**: Generate unique ID per request, pass via headers

**Tech**: Express.js + http-proxy-middleware

**Routes config**:
```javascript
const routes = {
  '/api/users': 'user-service:3001',
  '/api/packages': 'package-service:3002',
  '/api/orders': 'order-service:3003',
  '/api/customers': 'customer-service:3004',
  '/api/messages': 'message-service:3005',
  '/api/admin': 'admin-service:3006',
  '/api/email': 'email-service:3007',
};
```

**Health endpoints**:
- `GET /health` → overall gateway health
- `GET /health/services` → ping all downstream services

**Middleware stack**:
1. Request ID generation
2. CORS
3. Rate limiting (express-rate-limit)
4. Authentication (JWT verify via User Service public key or /auth/validate)
5. Logging (morgan + Winston)
6. Error handler (centralized)
7. Proxy handler (route matching)

**Dependencies**: User Service (for auth), all backend services

**Tests**: Routing correct, auth blocking, rate limiting, health checks

---

## Phase 4: Frontend

### Plan 11: Frontend Service

**Current**: React app in `src/` and `public/`

**Goal**: Package as standalone Docker service, served by Gateway or independently.

**Changes needed**:
- Update Axios base URL: from `http://localhost:3001` (hardcoded) to `http://localhost:3000` (gateway)
- If using environment variables: `REACT_APP_API_URL=http://localhost:3000`
- Keep React Router unchanged (frontend handles routing, gateway proxies /api/*)
- Create `frontend/Dockerfile` with multi-stage build (npm → build → nginx)

**Dockerfile**:
```dockerfile
# Build
FROM node:16 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**:
```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
  location /api/ {
    proxy_pass http://gateway:3000;
    proxy_set_header Host $host;
  }
}
```

**Deployment options**:
1. Gateway serves React static files (Gateway has route `/` → frontend build)
2. Frontend standalone container, gateway only proxies /api
3. Deploy to Netlify/Vercel + configure Gateway CORS

**Tests**: Build succeeds, routing works, API calls go through gateway

---

## Phase 5: Shared Libraries

### Plan 12: Shared Packages

**Why**: Avoid code duplication across services (error classes, config, validation, types).

**Packages**:

1. **@travel-agency/shared-errors**
   - Base `AppError` class
   - Standard error subclasses (BadRequest, NotFound, Conflict, Validation, etc.)
   - Error handler middleware

2. **@travel-agency/shared-config**
   - Environment variable loading
   - Config validation (Joi)
   - Service URLs

3. **@travel-agency/shared-types** (TypeScript optional but impressive)
   - TypeScript interfaces for all DTOs
   - API request/response types
   - Mongoose document types

4. **@travel-agency/shared-middleware**
   - Validation middleware (Joi schemas)
   - Authentication middleware
   - Rate limiting
   - Request logging

**Usage**:
```json
// service package.json
"dependencies": {
  "@travel-agency/shared-errors": "file:../../shared/shared-errors",
  "@travel-agency/shared-config": "file:../../shared/shared-config"
}
```

**Testing**: Each shared package has its own tests.

---

## Phase 6: Testing Strategy

### Plan 13: Comprehensive Testing Setup

**Per Service**:
```
tests/
├── unit/                    # Test services & utils in isolation
│   ├── user.service.test.js
│   ├── user.repository.test.js (with in-memory MongoDB)
│   └── mocks/
├── integration/             # Test API endpoints with test DB
│   └── api/
│       ├── auth.test.js
│       └── users.test.js
├── fixtures/               # Seed data for tests
│   ├── users.js
│   └── packages.js
└── setup.js               # Jest setup - DB connection, cleanup
```

**Test Database Strategy**:
- Use `{service-name}-test` database
- Jest beforeAll: connect, seed minimal data
- Jest afterEach: clear collections
- Jest afterAll: disconnect

**Mock Strategy**:
- Other services: nock HTTP calls
- MongoDB: Use `@shelf/jest-mongodb` or `mongodb-memory-server`
- RabbitMQ: Use `amqplib` mock or stub

**Coverage Target**: 80%+ (portfolio impressive)

**Scripts**:
```json
"scripts": {
  "test": "jest --coverage",
  "test:watch": "jest --watch",
  "test:integration": "jest --testPathPattern=integration",
  "test:unit": "jest --testPathPattern=unit"
}
```

**Root-level test aggregation**: `npm test` runs all service tests via Lerna

---

## Phase 7: CI/CD

### Plan 14: GitHub Actions

**Replace CircleCI** with GitHub Actions workflows:

**.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6
        ports: [27017:27017]
        options: --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'" --health-interval 10s --health-timeout 5s --health-retries 5
    strategy:
      matrix:
        service: [user-service, package-service, order-service, ...]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '16' }
      - run: npm ci
      - run: npm run test --workspace=services/${{ matrix.service }}
      - run: npm run lint --workspace=services/${{ matrix.service }}

  docker:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: docker-compose build
      - run: docker tag ...
      # Optional: push to registry
```

**PR checks**:
- ✅ Lint (ESLint)
- ✅ Format check (Prettier)
- ✅ Unit tests
- ✅ Integration tests (with MongoDB service)
- ✅ Coverage >= 70%

**Merge to main**:
- Build Docker images
- Push to Docker Hub (optional)
- Deploy to staging (optional)

---

## Phase 8: Observability

### Plan 15: Logging, Metrics, Tracing

**Logging** (Winston):
```javascript
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});
```

**Metrics** (Prometheus client or simple counters):
- Request count per endpoint
- Response time (p50, p95, p99)
- Error count
- Active connections

**Health Checks** (per service):
```javascript
app.get('/health', async (req, res) => {
  const dbConnected = await mongoose.connection.readyState === 1;
  res.json({
    status: dbConnected ? 'ok' : 'error',
    service: process.env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

**Tracing** (optional):
- Use express middleware to inject `X-Request-ID`
- Propagate through service-to-service calls
- Log with request ID for correlation

---

## Phase 9: Security

### Plan 16: Security Hardening

**Authentication**:
- JWT issued by User Service
- Gateway validates JWT signature (shared secret or public key)
- Refresh tokens stored in DB with revocation support

**Authorization**:
- Role-based middleware: `requireRole(['Admin', 'Agent'])`
- Permission matrix in config

**Rate Limiting**:
- Gateway: 100 req/min per IP
- Per service: 500 req/min per user ID (from JWT)
- Use `express-rate-limit` with Redis store (optional)

**Validation**:
- Joi schemas for all request bodies
- Sanitize inputs (no SQL/NoSQL injection - MongoDB already safe but still validate)
- Helmet.js for security headers

**Secrets**:
- Never commit .env
- Use Docker secrets or Kubernetes secrets in prod
- Rotate JWT_SECRET periodically

---

## Phase 10: Migration Execution

### Plan 17: Gradual Migration (Strangler Fig)

**Week 1-2**: Phase 0-1 (Infrastructure + RabbitMQ setup)
- Docker + K8s manifests (optional)
- RabbitMQ configured with exchanges/queues
- Test event publishing/consuming

**Week 3**: Extract User Service
- Most foundational (auth used by everything)
- Test thoroughly

**Week 4**: Extract Package Service (independent)
- No external dependencies

**Week 5**: Extract Customer Service
- Depends on User Service

**Week 6**: Extract Order Service
- Depends on Package Service
- Implement Saga pattern for order creation

**Week 7**: Extract Message Service
- Independent

**Week 8**: Extract Email Service
- RabbitMQ consumer for async emails

**Week 9**: Extract Admin Service
- Aggregates data from multiple services

**Week 10**: Gateway + Frontend
- Gateway routing complete
- Frontend Dockerized
- Switch frontend to gateway API URL

**Week 11**: Testing & Documentation
- All tests passing, coverage reports
- API documentation (Swagger per service)
- READMEs with setup instructions
- Architecture diagrams

**Migration Strategy**:
- Run monolith and microservices in parallel
- Gateway routes to microservices OR monolith (feature flag)
- Gradual cutover: first read operations, then writes
- Data sync: one-time migration from monolith DB to per-service DBs (script it)

---

## Critical Success Factors

1. **Test coverage before extraction** - Ensure monolith code tested before moving
2. **Service contracts** - Define API endpoints before implementing
3. **Event schemas** - Define RabbitMQ message formats upfront
4. **Observability from day 1** - Logs, health checks
5. **Database migrations** - Copy data from monolith collections to new DBs
6. **Idempotency** - Order creation must be idempotent (handle duplicates)
7. **Graceful degradation** - If Email Service down, order still created (event retry)

---

## RabbitMQ Setup

**docker-compose addition**:
```yaml
rabbitmq:
  image: rabbitmq:3-management
  container_name: rabbitmq
  restart: unless-stopped
  ports:
    - "5672:5672"   # AMQP protocol
    - "15672:15672" # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: password
  volumes:
    - rabbitmq-data:/var/lib/rabbitmq
  networks:
    - travel-network

volumes:
  rabbitmq-data:
```

**Exchanges & Queues** (defined in email-service or separate setup script):
- Exchange: `travel.events` (topic)
- Queues:
  - `email.order.created` (routing key: `order.created`)
  - `email.user.created` (`user.created`)
  - `admin.message.received` (`message.received`)
- Each service declares its queue and binds with routing key pattern

**Kubernetes**: Optional additional manifests for production RabbitMQ cluster (3-node for HA)

---

## Kubernetes Option (Optional)

**Create k8s/ directory**:
```
k8s/
├── namespaces/
│   └── travel-agency.yaml
├── configmaps/
│   └── shared-config.yaml
├── secrets/
│   └── secrets.yaml (template)
├── services/
│   ├── user-service.yaml
│   ├── package-service.yaml
│   └── ... (one per service)
├── deployments/
│   ├── user-service.yaml
│   └── ...
├── ingress/
│   └── nginx-ingress.yaml (or AWS ALB/GCLB)
├── rabbitmq/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── statefulset.yaml (for clustering)
└── mongodb/
    └── (use Helm charts or separate managed DB)
```

**Note**: For portfolio, Docker Compose is sufficient. K8s adds complexity but shows advanced skills. Include as "bonus" if time permits.

---

## Questions for User

1. **Free tier confirm**: Use CloudAMQP RabbitMQ or self-hosted Docker? → Self-hosted Docker is free, simpler
2. **K8s priority**: Essential for portfolio or optional bonus? → I'll create as separate optional plan
3. **Event-driven**: Should all services publish events? (User created, Package updated, etc.) → Yes, for full async communication
4. **Frontend deploy**: Keep served by Gateway or separate? → Gateway serves static files (simpler)
5. **DB migrations**: Should we write scripts to migrate data from monolith collections? → Yes, one-time script

---

## Next Steps

Start with **Plan 01** (Infrastructure Setup). It's the foundation for everything else.

---

**Document Version**: 2.0
**Last Updated**: 2026-04-02
