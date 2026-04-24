# Microservices Extraction Plan

## Phase 1: Current State Analysis ✅

### Existing Structure (User Service)
- **Location**: `services/user-service/`
- **Entry Point**: `src/app.js` - Express app with middleware, routes, and server startup
- **Routes**: `src/routes/auth.js` - Authentication routes (sign-up, login, get profile)
- **Services**: `src/services/UserService.js` - Business logic layer
- **Repositories**: `src/repositories/UserRepository.js` - Data access layer (extends BaseRepository)
- **Models**: `src/models/User.js` - Mongoose schema and model
- **Middleware**: `src/middleware/auth.js` - JWT authentication middleware
- **Utilities**: `src/utils/auth.js`, `src/utils/database.js`
- **Tests**: `tests/` directory

### Key Architecture Patterns Identified
1. **Dependency Injection**: UserService receives UserRepository in constructor
2. **Repository Pattern**: UserRepository extends BaseRepository from shared-utils
3. **Layered Architecture**: Routes → Services → Repositories → Models
4. **Middleware**: Express middleware for auth, rate limiting, CORS, helmet
5. **Error Handling**: Custom AppError from shared-errors, centralized error handler
6. **Configuration**: Environment-based config with dotenv

## Phase 2: Extraction Strategy 📋

### Approach: Extract User Service as Independent Microservice

**Target Service**: User Service
- Currently part of monolith in `services/user-service/`
- Will become standalone service with its own:
  - Server entry point
  - Database connection
  - Routes
  - Service layer
  - Repository layer
  - Tests

### Services to Extract (in priority order):
1. **User Service** (highest priority - authentication core)
2. **Package Service** (travel packages management)
3. **Order Service** (booking/reservations)
4. **Admin Service** (admin dashboard)
5. **Customer Service** (customer management)
6. **Message Service** (notifications)
7. **Email Service** (email notifications)

## Phase 3: Implementation Plan 🚀

### Step 1: Create User Service Structure
```
services/user-service/
├── src/
│   ├── app.js              # Express app (extracted from current app.js)
│   ├── server.js           # Server startup (new)
│   ├── routes/
│   │   └── auth.js         # Routes (already exists)
│   ├── services/
│   │   └── UserService.js  # Business logic (already exists)
│   ├── repositories/
│   │   └── UserRepository.js # Data access (already exists)
│   ├── models/
│   │   └── User.js         # Mongoose model (already exists)
│   ├── middleware/
│   │   └── auth.js         # Auth middleware (already exists)
│   └── utils/
│       └── database.js     # DB utilities (already exists)
├── package.json
├── .env
├── .env.example
└── tests/
```

### Step 2: Extract app.js to Separate Server Logic
Current `app.js` contains both app configuration AND server startup. Need to separate:
- **Keep in app.js**: Middleware setup, routes, error handlers
- **Move to server.js**: Database connection, server startup, graceful shutdown

### Step 3: Create Shared Configuration
- Extract common middleware (rate limiting, CORS, helmet) to shared config
- Create service-specific configuration in `.env`
- Update package.json with service-specific scripts

### Step 4: Update Dependencies
- Add shared utilities as local dependencies
- Ensure each service has independent database connection
- Configure service-to-service communication

### Step 5: Create API Gateway
- Route requests to appropriate services
- Handle service discovery
- Implement load balancing

## Phase 4: Database Design 🗄️

### User Service Database
- **Collection**: `users`
- **Indexes**: email (unique), username (unique), role
- **Schema**: Same as current User.js model
- **Connection**: Service-specific MongoDB connection

### Service Database Per Service Pattern
- Each microservice owns its database
- No shared collections between services
- Services communicate via APIs, not direct database access

## Phase 5: Testing Strategy 🧪

### Unit Tests
- Test UserService methods in isolation
- Mock repositories and external dependencies
- Cover all business logic

### Integration Tests
- Test API endpoints with real database
- Verify middleware functionality
- Test service-to-service communication

### E2E Tests
- Test complete user flows (signup → login → profile)
- Test error scenarios
- Test rate limiting and security

## Phase 6: Deployment Strategy 📦

### Dockerization
- Create Dockerfile for user-service
- Multi-stage build (dev and prod)
- Health checks
- Non-root user

### Kubernetes
- Deployment and Service manifests
- Resource limits
- Liveness/readiness probes

### CI/CD
- GitHub Actions workflow
- Test → Lint → Build → Deploy pipeline
- Environment-specific deployments

## Phase 7: Verification ✅

### Manual Testing
1. Start user-service independently
2. Test auth endpoints with Postman/curl
3. Verify database operations
4. Test error scenarios

### Automated Testing
1. Run unit tests: `npm test`
2. Run integration tests
3. Verify coverage > 70%

### Service Discovery
1. Verify service can start without other services
2. Test API endpoints independently
3. Verify graceful shutdown

## Critical Files to Modify

1. **`services/user-service/src/app.js`** - Extract server logic
2. **Create `services/user-service/src/server.js`** - Server startup
3. **`services/user-service/package.json`** - Update scripts and dependencies
4. **Create `services/user-service/.env`** - Service-specific config
5. **`services/user-service/.env.example`** - Environment template
6. **Create Dockerfile** - Containerization
7. **Create Kubernetes manifests** - Deployment configuration

## Next Steps

1. ✅ Analyze current structure (Complete)
2. Extract app.js into server.js
3. Create service package.json
4. Implement database connection
5. Add health checks
6. Write tests
7. Containerize
8. Repeat for other services