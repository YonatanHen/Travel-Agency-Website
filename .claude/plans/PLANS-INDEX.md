# Microservices Migration - Master Plan Index

**Status Legend**: ⏳ Not Started | 🔄 In Progress | ✅ Completed

---

## Quick Navigation by Phase

| Phase | Plan | Title | Status | Est. Time |
|-------|------|-------|--------|-----------|
| 0 | **01** | Infrastructure Setup (K8s) | ⏳ | 3-4h |
| 1 | **02** | Database Layer (Schemas & Repositories) | ⏳ | 4-6h |
| 2 | **03** | User Service (Auth) | ✅ | 6-8h |
| 2 | **04** | Package Service | 🔄 | 5-7h |
| 2 | **05** | Order Service | ⏳ | 7-9h |
| 2 | **06** | Customer Service | ⏳ | 5-6h |
| 2 | **07** | Message Service | ⏳ | 4-5h |
| 2 | **08** | Email Service | ⏳ | 5-7h |
| 2 | **09** | Admin Service | ⏳ | 5-6h |
| 3 | **10** | API Gateway | ⏳ | 6-8h |
| 4 | **11** | Frontend Service | ⏳ | 3-4h |
| 5 | **12** | Shared Libraries | ⏳ | 3-4h |
| 6 | **13** | Testing Strategy | ⏳ | 4-5h |
| 6 | **13A** | Contract Tests (Optional) | ⏳ | 3-4h |
| 7 | **14** | GitHub Actions CI/CD | ⏳ | 4-5h |
| 8 | **15** | Observability | ⏳ | 3-4h |
| 9 | **16** | Security Hardening | ⏳ | 4-6h |
| 10 | **17** | Gradual Migration Execution | ⏳ | 1-2w |

**Total Estimated Effort**: 60-80 hours (1.5-2 weeks with full-time work)

---

## Plans by Category

### Infrastructure (Phase 0)

#### Plan 01: Infrastructure Setup (K8s-First) ✅ ⏳
**File**: `01-infrastructure-setup.md`

**Objective**: Create K8s cluster with all services, databases, and RabbitMQ.

**Key Tasks**:
- 01-01: Create monorepo structure (services/, gateway/, frontend/, shared/)
- 01-02: NPM workspaces + Lerna config
- 01-03: Generate K8s manifests (Deployments, Services, StatefulSets)
- 01-04: ConfigMaps and Secrets
- 01-05: MongoDB & RabbitMQ deployment templates
- 01-06: Apply to cluster and verify

**Deliverables**:
- K8s namespace: `travel-agency`
- 6 MongoDB StatefulSets (or 1 cluster with 6 DBs)
- RabbitMQ 3-node cluster
- Gateway placeholder
- Service placeholders

**Dependencies**: None (first step)

**Prerequisites**:
- K8s cluster (Minikube, Docker Desktop K8s, Kind, or cloud provider)
- `kubectl` configured
- 8GB+ RAM for K8s cluster

---

### Database Layer (Phase 1)

#### Plan 02: Database Layer - Schemas & Repository Pattern ⏳
**File**: `02-database-layer.md`

**Objective**: Define schemas and implement Repository pattern for data abstraction.

**Key Tasks**:
- 02-01: Define 6 Mongoose schemas (User, Package, Order, Customer, Message, Admin)
- 02-02: Create BaseRepository with common CRUD
- 02-03: Implement concrete repositories per entity
- 02-04: Connection utility with DI
- 02-05: DB initialization scripts (indexes, seed data)
- 02-06: Data migration from monolith (one-time script)
- 02-07: Unit & integration tests for repositories

**Deliverables**:
- `src/models/{Entity}.js` per service
- `src/repositories/BaseRepository.js`
- `src/repositories/{Entity}Repository.js`
- `src/utils/database.js`
- Test suites with >70% coverage

**Dependencies**: Plan 01 (MongoDB running in K8s)

**Notes**:
- Use Mongoose for ODM
- Each service owns its database completely
- Denormalization where needed for performance
- Repository pattern enables testability

---

### Backend Services (Phase 2)

#### Plan 03: User Service (Authentication) ✅
**Extracted From**: `server/routers/user.js`

**Endpoints**:
- `POST /api/users/sign-up` - Register new user
- `POST /api/users/login` - Authenticate (returns JWT)
- `GET /api/users/:id` - Get profile
- `GET /api/users/validate` - Validate JWT
- `PUT /api/users/:id/role` - Modify role (admin only)
- `POST /api/users/password/reset` - Request reset (optional)
- `POST /api/users/password/update` - Update password

**Database**: `users` collection

**Events Published**:
- `user.created`
- `user.updated`
- `user.deleted`

**Architecture**:
```
src/
├── routes/auth.routes.js
├── routes/user.routes.js
├── services/auth.service.js (bcrypt, JWT)
├── services/user.service.js (business logic)
├── repositories/user.repository.js
├── models/User.js
└── utils/bcrypt.util.js
```

**Tests**:
- Unit: auth service (hash/compare), user service (validation)
- Integration: signup, login, JWT issuance, role modification
- Mock SendGrid for email-based flows

**Dependencies**: None (foundational)

**Estimated Time**: 6-8 hours

---

#### Plan 04: Package Service ⏳
**Extracted From**: `server/routers/package.js`

**Endpoints**:
- `GET /api/packages` - List (with pagination, filtering, search)
- `GET /api/packages/:id` - Single package
- `GET /api/packages/destination/:name` - By destination
- `GET /api/packages/rating/:min` - By minimum rating
- `POST /api/packages` - Create (admin)
- `PUT /api/packages/:id` - Update (admin)
- `DELETE /api/packages/:id` - Delete (admin)
- `POST /api/packages/:id/quantity/increment`
- `POST /api/packages/:id/quantity/decrement`
- `POST /api/packages/:id/rating` - Rate package

**Database**: `packages` collection

**Events Published**:
- `package.created`
- `package.updated`
- `package.rating.updated`

**Portfolio Enhancements**:
- Pagination (skip/limit, cursor-based)
- Filter: price range, duration, amenities
- Full-text search on name/description
- Caching layer (Redis) - optional
- Image upload to Cloudinary/S3 - optional

**Dependencies**: None (independent)

**Estimated Time**: 5-7 hours

---

#### Plan 05: Order Service ⏳
**Extracted From**: `server/routers/order.js`

**Endpoints**:
- `GET /api/orders` - All orders (admin/agent only)
- `GET /api/orders/customer/:userId` - Customer's orders
- `POST /api/orders` - Create order (Saga pattern)
- `PUT /api/orders/:id/status` - Update status
- `POST /api/orders/:id/cancel` - Cancel order
- `DELETE /api/orders/:id` - Delete
- `PUT /api/orders/status/bulk` - Bulk update (admin)

**Database**: `orders` collection

**Integration**: Package Service (validate availability, reserve quantity)

**Events Published**:
- `order.created` → triggers email confirmation
- `order.status.updated` → triggers email notification, package quantity update
- `order.canceled` → triggers package quantity refund

**Saga Pattern** (for order creation):
1. Validate package exists and has quantity
2. Reserve (decrement) package quantity
3. Create order document
4. Publish `order.created` event
5. If any step fails → compensation (increment quantity, delete order)

**Portfolio Enhancements**:
- Idempotency keys (prevent duplicate orders)
- Retry logic with exponential backoff
- Dead letter queue for failed events
- Order PDF generation (pdfkit)
- Timeout handling (5min for each saga step)

**Dependencies**: Package Service

**Estimated Time**: 7-9 hours (includes Saga implementation)

---

#### Plan 06: Customer Service ⏳
**Extracted From**: `server/routers/customers.js`

**Endpoints**:
- `GET /api/customers` - List all customers (admin/agent)
- `GET /api/customers/:id` - Customer profile
- `GET /api/customers/:id/orders` - Order history (calls Order Service)
- `PUT /api/customers/:id/profile` - Update profile
- `DELETE /api/customers/:id` - Delete account (anonymize?)

**Database**: `customers` collection

**Integration**: User Service (via API calls and RabbitMQ events)

**Data Sync Strategy**:
- Subscribe to `user.created`, `user.updated`, `user.deleted`
- Maintain denormalized customer data for fast queries
- Store additional fields: preferences, loyalty points, segment

**Events Published**:
- `customer.updated` (when profile changes)
- `customer.deleted` (trigger cleanup)

**Portfolio Enhancements**:
- Customer segmentation (VIP, regular, new)
- Travel preferences (dietary, accessibility, interests)
- Loyalty points system
- Booking history analytics

**Dependencies**: User Service

**Estimated Time**: 5-6 hours

---

#### Plan 07: Message Service ⏳
**Extracted From**: `server/routers/messages.js`

**Endpoints**:
- `GET /api/messages` - All messages (admin only)
- `GET /api/messages/unread` - Unread count & messages
- `POST /api/messages/contact` - Contact us form (public)
- `PUT /api/messages/:id/read` - Mark as read
- `DELETE /api/messages/:id` - Delete message

**Database**: `messages` collection

**Events**:
- `message.received` → Email Service sends auto-response, Admin notification

**Portfolio Enhancements**:
- Message threading (reply In-reply-to header)
- File attachments (store in S3, reference in message)
- Spam detection (Akismet API or simple keyword filter)
- Auto-reply templates (configurable)
- Admin dashboard with real-time updates (WebSocket)

**Dependencies**: None (independent)

**Estimated Time**: 4-5 hours

---

#### Plan 08: Email Service ⏳
**Extracted From**: `server/routers/email.js`

**Endpoints**:
- `POST /api/email/send` - Simple email
- `POST /api/email/send-to` - Custom recipient/subject/text
- `POST /api/email/broadcast` - Send to multiple recipients
- `POST /api/email/order-confirmation` - With order details
- `POST /api/email/booking-reminder` - Pre-trip reminder

**Database**: None (or optional `email_logs` for audit)

**Integration**: SendGrid API, RabbitMQ (consume events)

**RabbitMQ Consumers**:
- `order.created` → send confirmation email
- `user.created` → send welcome email
- `message.received` → send auto-response

**Implementation**:
- Queue-based processing (async)
- Email templates (Handlebars/EJS)
- Retry with exponential backoff
- Dead letter queue for failed emails
- SendGrid webhook handling (opens, clicks, bounces)

**Portfolio Enhancements**:
- Email template management UI (admin)
- A/B testing support
- Email analytics dashboard
- Rate limiting per service
- SPF/DKIM/DMARC configuration (documentation)

**Dependencies**: SendGrid account, RabbitMQ

**Estimated Time**: 5-7 hours

---

#### Plan 09: Admin Service ⏳
**Extracted From**: `server/routers/admin.js`, `routers/agents-admins.js`

**Endpoints**:
- `GET /api/admin/stats` - Dashboard metrics (bookings, revenue, users)
- `GET /api/admin/agents` - List travel agents
- `GET /api/admin/admins` - List admins
- `GET /api/admin/users/:id/role` - Change user role
- `GET /api/admin/orders/report` - Orders by date range (CSV export)
- `GET /api/admin/packages/metrics` - Package performance (ratings, bookings)
- `GET /api/admin/messages/recent` - Recent contact messages

**Database**: `admins` collection (or queries User Service with role filter)

**Integration**: User Service, Order Service, Package Service, Message Service

**Portfolio Enhancements**:
- Rich dashboard with charts (Chart.js/Recharts in React, but backend provides data)
- Audit logging (who changed what, when)
- Scheduled reports (daily/weekly email)
- Real-time metrics via WebSocket or SSE
- Role hierarchy (SuperAdmin > Admin > Agent)

**Dependencies**: User Service, Order Service, Package Service, Message Service

**Estimated Time**: 5-6 hours

---

### API Gateway (Phase 3)

#### Plan 10: API Gateway Service ⏳
**Purpose**: Single entry point with auth, routing, rate limiting.

**Responsibilities**:
1. **Routing**: Proxy `/api/users/*` → user-service:3001, etc.
2. **Authentication**: Validate JWT (public key or validate endpoint)
3. **Rate Limiting**: Per IP (100/min) and per user (500/min)
4. **Logging**: Structured logs with correlation IDs
5. **Health Checks**: `/health` (self) and `/health/services` (downstream)
6. **Error Aggregation**: Format consistent error responses
7. **CORS**: Single configuration

**Routes Config**:
```
/api/users/*      → user-service:3001
/api/packages/*   → package-service:3002
/api/orders/*     → order-service:3003
/api/customers/*  → customer-service:3004
/api/messages/*   → message-service:3005
/api/admin/*      → admin-service:3006
/api/email/*      → email-service:3007
/health           → self
```

**Tech Stack**: Express.js + http-proxy-middleware

**Architecture**:
```
src/
├── routes/           # Route definitions + proxy logic
├── middleware/       # Auth, rate-limit, logging, error
├── services/         # Service health checks
├── config/           # Route mapping
└── app.js
```

**Key Middleware**:
- `requestId()` - Generate X-Request-ID
- `cors()` - Configure CORS for frontend
- `rateLimit()` - express-rate-limit with Redis store (optional)
- `authenticate()` - Verify JWT via User Service
- `logger()` - Winston + Morgan
- `errorHandler()` - Central error formatting

**Health Checks**:
```javascript
app.get('/health', async (req, res) => {
  const services = await checkAllServices(); // Ping each service /health
  consthealthy = Object.values(services).every(s => s.healthy);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    services
  });
});
```

**Testing**:
- Unit: Middleware tests (auth blocks unauthenticated, rate limit triggers)
- Integration: Route proxy correct, health check aggregates
- Contract: Gateway → service HTTP calls

**Dependencies**: All backend services must be up

**Estimated Time**: 6-8 hours

---

### Frontend (Phase 4)

#### Plan 11: Frontend Service ⏳
**Current**: `src/` and `public/` directories

**Goal**: Package as standalone Docker container, served via Gateway or independently.

**Changes**:
1. Update Axios base URL:
   - From: `http://localhost:3001` (hardcoded monolith)
   - To: `http://localhost:3000` (gateway)
2. Use environment variable: `REACT_APP_API_URL`
3. Create `frontend/Dockerfile` (multi-stage: node → build → nginx)
4. Create `frontend/nginx.conf` (serve + proxy /api to gateway)

**Dockerfile**:
```dockerfile
# Build stage
FROM node:16 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# Production stage
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
    index index.html;
    try_files $uri $uri/ /index.html;
  }
  # Optional: proxy /api to gateway directly from nginx
  # location /api/ {
  #   proxy_pass http://gateway:3000;
  # }
}
```

**K8s Deployment** (add to `k8s/services/frontend/`):
- Deployment with image `travel-agency/frontend:latest`
- Service (ClusterIP or NodePort)
- Ingress rule to route `/*` to frontend (or gateway serves it)

**Testing**:
- Build succeeds without errors
- React Router navigation works
- API calls go to gateway
- Docker container serves correctly

**Dependencies**: Gateway must be deployed first

**Estimated Time**: 3-4 hours

---

### Shared Libraries (Phase 5)

#### Plan 12: Shared Libraries ⏳
**Goal**: Create reusable packages to avoid duplication.

**Packages**:

1. **@travel-agency/shared-errors**
   - Base `AppError` class (statusCode, isOperational)
   - Subclasses: BadRequest, Unauthorized, Forbidden, NotFound, Conflict, Validation
   - Error handler middleware

2. **@travel-agency/shared-config**
   - Load `.env` with dotenv
   - `Config.get(serviceName)` returns typed config
   - Validation (Joi) for required vars

3. **@travel-agency/shared-types** (TypeScript optional)
   - DTO interfaces (CreateUserDto, UpdatePackageDto, etc.)
   - API request/response types
   - Mongoose document types

4. **@travel-agency/shared-middleware**
   - Validation: Joi schema middleware
   - Authentication: JWT verification
   - Rate limiting: generic rate limiter
   - Logging: Winston logger instance

**Structure**:
```
shared/
├── errors/
│   ├── package.json
│   └── AppError.js
├── config/
│   ├── package.json
│   └── index.js
├── types/
│   ├── package.json
│   └── index.ts
└── middleware/
    ├── package.json
    ├── validation.js
    ├── auth.js
    └── rate-limit.js
```

**Usage**: `"@travel-agency/shared-errors": "file:../../shared/errors"`

**Dependencies**: None (standalone packages)

**Estimated Time**: 3-4 hours

---

### Testing (Phase 6)

#### Plan 13: Comprehensive Testing Strategy ⏳
**Goal**: 80%+ test coverage per service, full integration suite.

**Per Service**:
```
tests/
├── unit/
│   ├── user.service.test.js      # Test business logic with mocks
│   ├── user.repository.test.js   # Test repo with in-memory DB
│   ├── auth.routes.test.js       # Test routes with Supertest
│   └── mocks/
├── integration/
│   └── api/
│       ├── auth.test.js
│       ├── users.test.js
│       └── health.test.js
├── fixtures/
│   ├── users.js
│   └── packages.js
└── setup.js                      # Jest setup - DB connection
```

**Test Types**:

1. **Unit Tests**:
   - Services: test business logic, mock repositories
   - Utilities: bcrypt, validators
   - Repositories: mock model, test query building

2. **Integration Tests**:
   - API endpoints with test DB
   - Full request → response cycle
   - Database assertions after request

3. **E2E Tests** (Critical Flows):
   - User registration → login → browse packages → create order → receive email (mock)
   - Admin dashboard: stats aggregation
   - Cross-service: Order creation triggers package quantity decrement

**Test Database**:
- Use `mongodb-memory-server` (real MongoDB in memory) or `@shelf/jest-mongodb`
- Auto-setup and cleanup per test suite
- Seed with fixture data

**Coverage**: Target 80%+ statements, branches, functions

**Scripts**:
```json
"scripts": {
  "test": "jest --coverage --detectOpenHandles",
  "test:watch": "jest --watch",
  "test:unit": "jest --testPathPattern=unit",
  "test:integration": "jest --testPathPattern=integration",
  "test:e2e": "jest --testPathPattern=e2e"
}
```

**Root level**: `npm test` runs all services via Lerna

**Dependencies**: Jest, Supertest, mongodb-memory-server

**Estimated Time**: 4-5 hours (per service, but can be parallelized)

---

#### Plan 13A: Contract Testing (Optional Bonus) ⏳
**Tool**: Pact or similar

**Goal**: Verify service contracts (API responses) match expectations without hitting real services.

**Pattern**: Consumer-Driven Contracts

- Define expected request/response pairs
- Generate pact files
- Verify provider against pact

**Impressive for portfolio but time-consuming**.

**Estimated Time**: 3-4 hours (if included)

---

### CI/CD (Phase 7)

#### Plan 14: GitHub Actions CI/CD ⏳
**Replace CircleCI** with GitHub Actions.

**Workflows**:

1. **PR Checks** (`.github/workflows/ci.yml`):
```yaml
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6
        ports: [27017:27017]
    strategy:
      matrix:
        service: [user-service, package-service, ...]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '16' }
      - run: npm ci
      - run: npm run lint --workspace=services/${{ matrix.service }}
      - run: npm run test --workspace=services/${{ matrix.service }} -- --coverage
      - uses: codecov/codecov-action@v3  # Upload coverage

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t ${{ github.sha }} ./services/${{ matrix.service }}
```

2. **Build & Push** (on merge to main):
```yaml
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t ghcr.io/yourname/${{ matrix.service }}:latest ./services/${{ matrix.service }}
      - run: docker push ghcr.io/yourname/${{ matrix.service }}:latest
    strategy:
      matrix:
        service: [user-service, package-service, ...]
```

**Quality Gates**:
- All tests pass
- Coverage >= 70%
- No lint warnings
- Security audit (`npm audit`) passes

**Dependencies**: All services have Dockerfiles

**Estimated Time**: 4-5 hours

---

### Observability (Phase 8)

#### Plan 15: Observability - Logs, Metrics, Tracing ⏳
**Goal**: Production-ready monitoring.

**Logging** (Winston):
```javascript
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});
```

**Metrics** (prom-client):
```javascript
const client = require('prom-client');
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5]
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

**Tracing** (OpenTelemetry or simple X-Request-ID):
- Generate unique request ID in gateway
- Propagate via `X-Request-ID` header
- Include in all logs

**Health Checks** (K8s ready):
```javascript
app.get('/health/live', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/health/ready', async (req, res) => {
  try {
    await db.ping();
    await rabbitmq.checkConnection();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});
```

**Dashboard**: Grafana (optional) or simple metrics endpoint aggregated by Prometheus.

**Dependencies**: prom-client, winston, opentelemetry-api

**Estimated Time**: 3-4 hours

---

### Security (Phase 9)

#### Plan 16: Security Hardening ⏳
**Areas**:

1. **Authentication**:
   - JWT with RS256 (private key in User Service, public key in Gateway)
   - Refresh tokens stored in DB with revocation
   - Token blacklist (Redis) for logout

2. **Authorization**:
   - RBAC middleware: `requireRole(['Admin', 'Agent'])`
   - Permissions matrix defined in config

3. **Rate Limiting**:
   - Gateway level: `express-rate-limit` with Redis store
   - Per-user: Extract user ID from JWT, limit to 500/min
   - Per-IP: 100/min for unauthenticated

4. **Validation**:
   - Joi schemas for all request bodies
   - Sanitize inputs (escape HTML, prevent XSS)
   - Helmet.js for security headers

5. **Secrets**:
   - K8s Secrets (base64 encoded)
   - For production: integrate with external secret manager
   - Never commit secrets to git

6. **CORS**:
   - GatewayCORS configured for frontend origin only
   - No wildcard in production

**Implementation Tasks**:
- Add JWT validation middleware to Gateway
- Implement RBAC decorator middleware
- Configure rate limiting with Redis
- Add Joi validation to all routes
- Enable Helmet in all services
- Document security checklist

**Estimated Time**: 4-6 hours

---

### Migration Execution (Phase 10)

#### Plan 17: Gradual Migration (Strangler Fig) ⏳
**Strategy**: Run monolith and microservices in parallel, gradually shift traffic.

**Week 1-2** (Infrastructure):
- Plan 01: K8s cluster up, databases running

**Week 3** (Extract User Service):
- Plan 02-03: Implement User Service, deploy
- Update Gateway to route `/api/users/*` to User Service
- Monolith still serves other endpoints
- Test full auth flow

**Week 4** (Package Service):
- Plan 04: Package Service
- Gateway routes `/api/packages/*`

**Week 5** (Customer Service):
- Plan 06: Customer Service
- Depends on User Service integration

**Week 6** (Order Service):
- Plan 05: Order Service with Saga
- Most complex; test thoroughly

**Week 7** (Message + Email):
- Plan 07-08: Message + Email Services

**Week 8** (Admin Service):
- Plan 09: Admin Service

**Week 9** (Gateway + Frontend):
- Plan 10-11: Gateway complete, Frontend Dockerized
- Point frontend to gateway

**Week 10-11** (Testing & Polish):
- All integration tests
- Load testing
- Documentation
- Code coverage reports

**Data Migration**:
- One-time script (Plan 02-06) copies monolith data
- Run during maintenance window
- Update services to point to new DBs
- Decommission monolith DB

**Feature Flags** (optional):
- Use Unleash or config flags
- Gradually enable microservice routes
- Rollback capability

**Monitoring**:
- Compare error rates: monolith vs microservice
- Latency p95 per service
- Database connection pools

**Estimated Time**: 1-2 weeks (parallel work possible)

---

## Execution Order (Critical Path)

```
Plan 01 (Infrastructure)
    ↓
Plan 02 (Database Layer)
    ↓
Plan 03 (User Service) ────┐
    ↓                       │
Plan 04 (Package) ──────────┤
    ↓                       │
Plan 06 (Customer) ────────┤
    ↓                       │
Plan 05 (Order) ───────────┤ (can parallelize)
    ↓                       │
Plan 07 (Message) ─────────┤
    ↓                       │
Plan 08 (Email) ───────────┤
    ↓                       │
Plan 09 (Admin) ───────────┘
    ↓
Plan 10 (Gateway)
    ↓
Plan 11 (Frontend)
    ↓
Plans 12-16 (can add anytime, even after 10-11)
Plan 17 (migration execution) overlaps with above
```

**Note**: Plans 03-09 (services) can be implemented in parallel by splitting work across team members. Dependencies only on Plan 02 and on Package before Order, User before Customer.

---

## Checklists Before Each Plan

**Before starting Plan 02**:
- [ ] Plan 01 complete (K8s cluster with DBs running)
- [ ] Schemas finalized (review with stakeholder)
- [ ] Repository pattern agreed upon

**Before starting Plans 03-09**:
- [ ] Plan 02 complete (repositories tested)
- [ ] Shared errors/config packages published (Plan 12)
- [ ] RabbitMQ configured (queues, exchanges)

**Before starting Plan 10**:
- [ ] At least 2-3 services deployed (for routing testing)
- [ ] Authentication strategy finalized (JWT flow)

**Before starting Plan 11**:
- [ ] Gateway deployed (or at least routes defined)
- [ ] API contracts stable

---

## Common Pitfalls & Mitigation

| Pitfall | Mitigation |
|---------|------------|
| Database deadlocks | Use idempotent operations, timeouts |
| Circular dependencies | Dependency graph analysis, event-driven instead of direct calls |
| Data inconsistency across services | Eventual consistency, compensating transactions |
| Network timeouts | Circuit breakers, retries with backoff |
| Secret leakage | .gitignore, pre-commit hooks, secret scanning |
| Test flakiness | Use test DB with fixtures, clean state between tests |
| Service discovery fails | Use K8s DNS names, health checks |
| RabbitMQ message loss | Persistence enabled, acknowledgments, DLQ |

---

## Success Metrics

At project completion:
- ✅ All 7 backend services deployed on K8s
- ✅ Each service has separate MongoDB database
- ✅ RabbitMQ cluster running (3 nodes)
- ✅ API Gateway routing all traffic
- ✅ Frontend served via Gateway or independently
- ✅ All services have >70% test coverage
- ✅ GitHub Actions CI/CD passing
- ✅ Documentation complete (README per service, architecture diagram)
- ✅ No code duplication (shared libraries used)
- ✅ SOLID principles applied (layered architecture, DI)
- ✅ Observability (logs, metrics, health checks)
- ✅ Security hardened (auth, rate limiting, validation)

---

## Notes

- **K8s vs Docker Compose**: This plan uses K8s as primary. For local dev without cluster, use Docker Compose (simpler docker-compose.yml provided in Plan 01 notes).
- **Parallel Work**: Services 03-09 can be implemented simultaneously by different people.
- **Monolith during Migration**: Keep monolith running until all services cut over. Use Gateway to route to either.
- **Portfolio**: Emphasize K8s, RabbitMQ event-driven, Repository pattern, SOLID, Saga pattern for Orders.
- **Cost**: All tools are free (K8s open-source, RabbitMQ open-source, MongoDB Community). Use Docker Desktop (free) or Minikube.

---

**Next Step**: Continue **Plan 04** - complete package-service integration tests and finalize docs, then move to Plan 05 (Order Service).

Run: `mkdir -p .claude/plans && create plan 01` (or manually execute steps).

---

**Last Updated**: 2026-04-02
**Version**: 1.0
