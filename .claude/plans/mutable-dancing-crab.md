# Plan 03: Extract User Service (Authentication)

## Context

Plan 02 (Database Layer) is complete with all 6 services having fully tested repositories, models, and connection utilities. All 70 unit tests pass.

Now we need to extract the **User Service** (authentication) from the monolith into its own microservice. This is the first business service to be extracted, making it the foundation for all other services that will need to authenticate users.

The original monolith `server/routers/user.js` has two endpoints:
- `POST /sign-up` - user registration with password hashing (bcrypt)
- `POST /login` - authenticate via username/email + password

## What Needs to Be Built

The user-service directory structure exists but key files are missing:

```
services/user-service/src/
├── models/User.js ✅ (exists, complete)
├── repositories/UserRepository.js ✅ (exists, complete)
├── utils/
│   └── database.js ✅ (exists)
├── scripts/ ✅ (exists)
├── routes/ ❌ (empty) - need to create
├── services/ ❌ (empty) - need to create
└── app.js ❌ - missing entry point
```

## Implementation Approach

### 1. Add JWT Dependency

Update `services/user-service/package.json` to include `jsonwebtoken` in dependencies (runtime), not devDependencies.

### 2. Create Authentication Utilities (`src/utils/auth.js`)

Create a utility module that handles:
- `generateToken(userId, role, email)` - signs JWT with HS256, 24h expiry
- `verifyToken(token)` - verifies and decodes JWT, returns payload or throws
- `generateRefreshToken(userId)` - optional long-lived token (7 days)
- Configuration: read JWT_SECRET from environment via shared-config

Location: `services/user-service/src/utils/auth.js`

### 3. Create Authentication Middleware (`src/middleware/auth.js`)

Create middleware for route protection:
- `authenticateJWT` - verifies JWT from Authorization header (Bearer token)
- Extracts user ID from token, attaches `req.userId`, `req.userRole`
- Calls `next()` or returns 401 Unauthorized

Location: `services/user-service/src/middleware/auth.js`

### 4. Create User Service (`src/services/UserService.js`)

Business logic layer that orchestrates repository calls, validation, password hashing.

Responsibilities:
- `registerUser(data)` - validate input, check uniqueness (username & email), hash password, save user, return user without password
- `loginUser(identifier, password)` - find by username OR email, verify password, generate JWT tokens, return tokens + user info
- `getUserById(id)` - fetch user by ID with password excluded
- `validateUserData(data)` - input validation using Joi (ensure required fields, email format, password length)

Inject dependencies via constructor:
- `userRepository` (from `UserRepository.js`)
- `bcrypt` (direct dependency)
- `jwt` (from jsonwebtoken)

### 5. Create Routes (`src/routes/auth.js`)

Express routes that handle HTTP concerns only:

**POST /api/auth/sign-up**
- Validate request body (Joi): username (min 3, max 30, unique), email (valid), password (min 6), confirmPass must match
- Call `userService.registerUser(req.body)`
- On success 201 Created: return `{ id, username, email, role }` (no password)
- On error: 409 Conflict (username exists), 400 Bad Request (validation), 500 Server Error

**POST /api/auth/login**
- Validate: username/email, password required
- Call `userService.loginUser(req.body.username, req.body.password)`
- On success 200 OK: return `{ token, refreshToken, user: { id, username, email, role } }`
- On error: 404 Not Found, 401 Unauthorized (bad password), 500 Server Error

**GET /api/auth/me** (protected)
- Protected by `authenticateJWT` middleware
- Call `userService.getUserById(req.userId)`
- Return user object (no password)

Export router.

### 6. Create Main App (`src/app.js`)

Express application entry point:

- Load environment config via `@travel-agency/shared-config`
- Connect to MongoDB via `database.connect()`
- Initialize models (User.init()) and indexes
- Setup middlewares: helmet, cors, express-rate-limit, express.json()
- Register routes: `app.use('/api/auth', authRouter)`
- Health check endpoint: `GET /health` returns `{ status: 'ok', timestamp, service: 'user-service' }`
- Global error handler: catch AppError, send proper status & message
- Start server on port from config, log message

### 7. Update Jest Config for Integration Tests

The existing `jest.config.js` is for unit tests only. We need integration tests for routes. The `@shelf/jest-mongodb` preset should work; we may need to add `setupFilesAfterEnv` for test helpers.

Create `tests/integration/` directory with:
- `auth.integration.test.js` - test sign-up, login, /me endpoints with Supertest

### 8. Update Global Configuration

`globalConfig.json` should include:
```json
{
  "mongodb": { "url": "mongodb://localhost:27017", "database": "user_service_db" },
  "jwt": { "secret": "CHANGE_IN_PRODUCTION", "expiresIn": "24h" },
  "server": { "port": 3002 }
}
```

### 9. Update package.json Scripts

Ensure scripts exist:
- `"start": "node src/app.js"`
- `"dev": "nodemon src/app.js"`
- `"test": "jest --coverage"` (already there)

### 10. Create Unit Tests for UserService

File: `tests/unit/services/UserService.test.js`

Mock:
- `UserRepository` (all methods)
- `bcrypt.hash`, `bcrypt.compare`
- `jwt.sign`, `jwt.verify` (or just test that generateToken calls jwt.sign)

Test coverage:
- `registerUser` success
- `registerUser` username/email already exists (throws ConflictError)
- `registerUser` validation failures
- `registerUser` password hashing
- `loginUser` success with JWT
- `loginUser` user not found
- `loginUser` wrong password
- `getUserById` found/excludes password
- `validateUserData` validation rules

### 11. Create Integration Tests

File: `tests/integration/auth.routes.test.js`

Use `@shelf/jest-mongodb` to spin up MongoDB, connect app, use Supertest.
Test full HTTP flow:
- `POST /api/auth/sign-up` 201 with valid payload
- `POST /api/auth/sign-up` 409 duplicate username
- `POST /api/auth/login` 200 returns token
- `POST /api/auth/login` 401 invalid credentials
- `GET /api/auth/me` 200 with valid Authorization header
- `GET /api/auth/me` 401 without token

### 12. Update .env.example

Add:
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SERVICE_NAME=user-service
```

## Key Design Principles Applied

- **Layered Architecture**: Routes → Services → Repositories → Models
- **Dependency Injection**: UserService receives UserRepository in constructor (DI)
- **Single Responsibility**: Each layer has clear responsibility
- **Testability**: Service tests mock repository, route tests use in-memory DB
- **Error Handling**: Custom errors from `@travel-agency/shared-errors` (ConflictError, AuthenticationError, ValidationError)
- **Security**: Passwords hashed with bcrypt (10 rounds), JWT signing, never return passwords
- **DRY**: Reuse BaseRepository, DatabaseService, config, errors from shared packages
- **RESTful**: Proper HTTP status codes, resource-oriented URLs

## Files to Create

**New files:**
1. `services/user-service/src/utils/auth.js`
2. `services/user-service/src/middleware/auth.js`
3. `services/user-service/src/services/UserService.js`
4. `services/user-service/src/routes/auth.js`
5. `services/user-service/src/app.js`
6. `services/user-service/tests/unit/services/UserService.test.js`
7. `services/user-service/tests/integration/auth.routes.test.js`

**Modifications:**
1. `services/user-service/package.json` - add `jsonwebtoken`, `bcryptjs` (or keep `bcrypt` from original), `joi` (already there)
2. `services/user-service/globalConfig.json` - add JWT secret & server port
3. `services/user-service/.env.example` - add `JWT_SECRET`
4. `services/user-service/README.md` (optional) - document API endpoints

## Verification Steps

1. **Unit tests**: Run `npm test` in user-service - all unit tests pass (including new UserService tests)
2. **Integration tests**: Run `npm test` - integration tests hit real MongoDB (via @shelf/jest-mongodb), test full HTTP flow
3. **Manual test**: `npm run dev` starts server, test with curl/Postman:
   - `POST http://localhost:3002/api/auth/sign-up` with user data ✓
   - `POST http://localhost:3002/api/auth/login` returns JWT ✓
   - `GET http://localhost:3002/api/auth/me` with Authorization header returns user ✓
4. **Health check**: `GET http://localhost:3002/health` returns OK

## Success Criteria

- All unit and integration tests pass (≥ 80% coverage on services/routes)
- Sign-up creates user with hashed password (verify in DB)
- Login returns valid JWT that can be used to access /me
- Protected routes reject requests without token
- Proper error responses (401, 404, 409, 500)
- Follows layered architecture (routes don't access repository directly)

## Estimated Scope

- ~200-300 lines of new code (excluding tests)
- ~150 lines of tests
- Implementation time: 30-45 minutes

---

Ready to implement? This will complete the first functional microservice (User Service) and set pattern for extracting the others.
