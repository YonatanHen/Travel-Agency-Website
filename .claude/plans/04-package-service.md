# Plan 04: Extract Package Service (Travel Packages Catalog)

## Progress Update (2026-04-24)

### Completed
- Core package-service runtime was implemented and pushed in commit `7f9c434`:
  - `src/app.js`
  - `src/services/PackageService.js`
  - `src/routes/package.routes.js`
  - `src/middleware/auth.js`
  - test bootstrap in `tests/setup.js`
- Configuration and dependency updates were applied:
  - `.env.example`, `globalConfig.json`, `package.json`, `jest.config.js`
  - switched from `@shelf/jest-mongodb` to `mongodb-memory-server`
- Unit test coverage expanded:
  - `tests/unit/services/PackageService.test.js` added
  - existing repository unit tests still pass

### In Progress
- Integration suite `tests/integration/packages.routes.test.js` is created but unstable.
- Current blocker is mongoose connection mismatch/buffering behavior during integration tests.

### Remaining To Finish Plan 04
1. Stabilize integration DB lifecycle and make `packages.routes` integration tests pass.
2. Run full package-service test suite reliably (`npm test`).
3. Update `services/package-service/README.md` with endpoints/config/test usage.
4. Mark Plan 04 complete and start Plan 05 (Order Service).

## Context

**Prerequisites Complete:**
- ✅ Plan 02: Database Layer (all 6 services have repositories, models, unit tests)
- ✅ Plan 03: User Service (authentication) complete and tested
- ✅ Shared packages: `@travel-agency/shared-errors`, `@travel-agency/shared-config`, `@travel-agacy/shared-utils`, `@travel-agency/shared-repositories`

**Current State (updated):**
- All 6 service directories exist with scaffolding from Plan 02
- `services/package-service/` has:
  - `src/models/Package.js` ✅
  - `src/repositories/PackageRepository.js` ✅
  - `src/utils/database.js` ✅
  - `src/scripts/` (create-indexes.js, seed.js) ✅
  - `jest.config.js` ✅
- Core app/routes/services/auth/config are implemented.
- Remaining gap: integration test stability + final documentation polish.

## What Needs to Be Built

Complete the package-service to expose CRUD operations for travel packages with full authentication and authorization.

### Implementation Phases

#### Phase 1: Core Service Setup (30 min)

1. **Update package.json**
   - Add missing dependencies: none really, we have everything from Plan 03 pattern
   - Ensure scripts: `"start": "node src/app.js"`, `"test": "jest --coverage"`

2. **Create Main App (`src/app.js`)**
   - Copy pattern from user-service but adapt for package-service
   - No JWT needed (read-only public endpoints for GETs)
   - Admin-only for POST/PUT/DELETE (use JWT from User Service)
   - Middleware: helmet, cors, express.json(), rate limiting (skip in test)
   - Routes: `/api/packages` (router)
   - Health check: `/health`
   - Global error handler
   - Auto-start condition: `if (require.main === module && process.env.NODE_ENV !== 'test') startServer()`
   - Export: `module.exports = app`

3. **Update `globalConfig.json`**
   ```json
   {
     "mongodb": {
       "url": "mongodb://127.0.0.1:55490/",
       "database": "package_service_db"
     },
     "server": {
       "port": 3003,
       "cors": { "origin": "*", "credentials": false }
     }
   }
   ```
   - No JWT section needed (package-service doesn't issue tokens)

4. **Update `.env.example`**
   ```
   PORT=3003
   SERVICE_NAME=package-service
   MONGODB_URL=mongodb://127.0.0.1:55490/
   MONGODB_DATABASE=package_service_db
   ```

#### Phase 2: Business Logic Layer (45 min)

1. **Create `src/services/PackageService.js`**

   Methods:
   - `createPackage(data)` - Admin only. Validate price, duration, destination, amenities, quantity. Save and return.
   - `getPackageById(id)` - Public. Find by ID, exclude internal fields (like `__v`).
   - `updatePackage(id, updates)` - Admin only. Validate updates, save, return updated.
   - `deletePackage(id)` - Admin only. Soft delete (set `isActive: false`) or hard delete?
   - `listPackages(options)` - Public with pagination, filtering, sorting
     - Options: `{ page, limit, skip, sort, filters: { destination, minPrice, maxPrice, minRating, isActive } }`
   - `findByDestination(destination)` - Public, search by destination (partial, case-insensitive)
   - `addRating(packageId, rating)` - Append to ratings array, recalculate average rating
   - `incrementQuantity(packageId)` / `decrementQuantity(packageId)` - For order booking flow

   Injectable dependencies:
   - `packageRepository` (from `PackageRepository.js`)

2. **Input Validation with Joi** (in service layer)

   ```javascript
   const packageSchema = Joi.object({
     name: Joi.string().min(2).max(100).required(),
     description: Joi.string().max(1000).required(),
     destination: Joi.string().required(),
     price: Joi.number().min(0).required(),
     duration: Joi.number().min(1).required(), // days
     maxPax: Joi.number().min(1).required(),
     amenities: Joi.array().items(Joi.string()),
     images: Joi.array().items(Joi.string().uri()),
     isActive: Joi.boolean().default(true)
   })
   ```

#### Phase 3: Routes & Authorization (30 min)

1. **Create `src/routes/package.routes.js`**

   All routes under `/api/packages`

   - `GET /` - List packages (public)
     - Query params: `?page=1&limit=20&destination=Paris&minPrice=1000&maxPrice=5000&sort=-createdAt`
     - Returns: `{ packages: [], total, page, limit, totalPages }`
   - `GET /:id` - Get single package (public)
     - Returns package object
   - `POST /` - Create package (admin only)
     - Body: full package object
     - Returns created package
   - `PUT /:id` - Update package (admin only)
     - Body: partial updates
     - Returns updated package
   - `DELETE /:id` - Delete package (admin only)
     - Soft delete (set `isActive: false`) or hard delete
   - `GET /destination/:name` - Find by destination (public)
     - Return packages matching destination (partial match)
   - `POST /:id/quantity/increment` - Increment quantity (internal, called by Order Service)
   - `POST /:id/quantity/decrement` - Decrement quantity (internal, called by Order Service)
   - `POST /:id/rating` - Add rating (authenticated user)
     - Body: `{ rating: number (1-5) }`
     - Recalculates average rating

   Authorization:
   - Admin-only routes: POST, PUT, DELETE, quantity adjustments
   - Use middleware: `authenticateJWT` (from user-service shared? But we can't import from another service directly! Must implement own JWT verification)
     - **Solution**: Package service needs its own `src/middleware/auth.js` that reuses the same auth utility pattern from user-service. Or we could extract auth middleware to shared package.
     - For now: copy user-service's `authenticateJWT` middleware and use it

2. **Create `src/middleware/auth.js`** (if not shared yet)

   Copy from user-service:
   - `authenticateJWT` - verifies JWT using secret from config
   - `authorizeRole(...allowedRoles)` - checks `req.userRole`

   Note: This duplicates code. In Plan 12 (Shared Libraries) we'll extract to `@travel-agency/shared-middleware`.

#### Phase 4: Testing (60 min)

1. **Update Jest Config**

   Ensure:
   ```javascript
   module.exports = {
     testEnvironment: 'node',
     setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
     testMatch: ['**/tests/**/*.test.js'],
     collectCoverage: true,
     collectCoverageFrom: ['src/**/*.js', '!src/models/**', '!src/utils/**']
   }
   ```

   No preset (we use manual mongodb-memory-server in integration tests)

2. **Create `tests/setup.js`**

   ```javascript
   if (!process.env.JWT_SECRET) {
     process.env.JWT_SECRET = 'test-jwt-secret'
   }
   if (!process.env.PORT) process.env.PORT = '3003'
   if (!process.env.SERVICE_NAME) process.env.SERVICE_NAME = 'package-service'
   if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test'
   ```

3. **Unit Tests: `tests/unit/repositories/PackageRepository.test.js`** (already exists from Plan 02)

   ✅ Already complete! Just need to verify they pass.

4. **Unit Tests: `tests/unit/services/PackageService.test.js`**

   Mock:
   - `PackageRepository` (all methods: findById, save, find, findByDestination, addRating, etc.)
   - No bcrypt needed

   Test cases:
   - `createPackage()`: valid data → saved; missing required fields → throws BadRequestError; duplicate name? (no constraint)
   - `getPackageById()`: found → returns; not found → throws NotFoundError
   - `updatePackage()`: valid updates → saved; invalid ID → throws BadRequestError
   - `deletePackage()`: sets isActive false; non-existent → throws NotFoundError
   - `listPackages()`: pagination works; filters applied correctly (destination, price range); sorting works
   - `findByDestination()`: case-insensitive partial match
   - `addRating()`: adds to array, recalculates average, validates rating 1-5
   - `incrementQuantity()` / `decrementQuantity()`: adjust quantity correctly

5. **Integration Tests: `tests/integration/packages.routes.test.js`**

   Setup: Use `mongodb-memory-server` (copy pattern from user-service fixed version)

   Test cases:
   - **Public Endpoints**:
     - `GET /api/packages` 200 with pagination, filters
     - `GET /api/packages/:id` 200 returns package
     - `GET /api/packages/destination/:name` 200 returns matches
   - **Admin Endpoints** (with JWT):
     - `POST /api/packages` 201 creates package (admin token)
     - `POST /api/packages` 401 without token
     - `POST /api/packages` 403 with non-admin token (Customer role)
     - `PUT /api/packages/:id` 200 updates (admin)
     - `DELETE /api/packages/:id` 200 deletes (admin)
   - **Rating**:
     - `POST /api/packages/:id/rating` 200 with valid rating (authenticated)
     - `POST /api/packages/:id/rating` 400 for rating out of range
   - **Quantity**:
     - `POST /api/packages/:id/quantity/decrement` 200 (admin)
   - **Health**: `GET /health` 200

   Important: Create helper functions to generate admin JWT token using same secret as config.

6. **Run All Tests**

   ```bash
   npm test --prefix services/package-service
   ```

   Expected: All 20+ tests passing, coverage >70%.

#### Phase 5: Final Polish (15 min)

1. **Verify package.json scripts**
   - `"start": "node src/app.js"`
   - `"test": "jest --coverage"`
   - `"seed": "node src/scripts/seed.js"` (optional)

2. **Update README.md** (create if missing)
   - API endpoints list
   - How to run
   - Configuration variables
   - Test instructions

3. **Update `globalConfig.json`** with complete config (already done in Phase 1)

4. **Commit & Push**

   ```bash
   git add -A
   git commit -m "feat(package-service): complete Plan 04 - Package Service extraction"
   git push origin microservices-migration
   ```

## Design Principles Applied (from Plan 03)

- **Layered Architecture**: Routes → Services → Repositories → Models
- **Dependency Injection**: Service receives repository in constructor
- **Single Responsibility**: Each layer has clear concern
- **Testability**: Repository mocked in service tests; integration tests use in-memory DB
- **Error Handling**: Custom errors from `@travel-agency/shared-errors` (BadRequestError, NotFoundError, ConflictError)
- **RESTful**: Proper HTTP verbs and status codes
- **Security**: JWT authentication for admin routes; never expose internal fields (like `_v`, `createdAt` can be exposed)
- **DRY**: Reuse BaseRepository, DatabaseService singleton, shared error classes

## Files to Create

**New files:**
1. `services/package-service/src/app.js`
2. `services/package-service/src/services/PackageService.js`
3. `services/package-service/src/routes/package.routes.js`
4. `services/package-service/src/middleware/auth.js` (copy from user-service pattern)
5. `services/package-service/tests/setup.js` (if not exists)
6. `services/package-service/tests/unit/services/PackageService.test.js`
7. `services/package-service/tests/integration/packages.routes.test.js`

**Modifications:**
1. `services/package-service/package.json` - verify scripts
2. `services/package-service/globalConfig.json` - complete config (mongodb + server)
3. `services/package-service/.env.example` - add PORT, SERVICE_NAME, MONGODB_URL

## Estimation

- **Implementation**: 2-3 hours (faster now that we have user-service as template)
- **Testing**: 1 hour
- **Total**: 3-4 hours

---

## Success Criteria

- ✅ All unit tests pass (PackageService + existing PackageRepository tests)
- ✅ All integration tests pass (14+ scenarios)
- ✅ Test coverage >70%
- ✅ Public endpoints work without authentication
- ✅ Admin endpoints require valid JWT with Admin role
- ✅ Health check returns `{ status: 'ok', service: 'package-service', database: 'connected' }`
- ✅ CRUD operations work correctly
- ✅ Rating average recalculates properly
- ✅ Pagination, filtering, sorting all functional

---

## Next Step After This

Once Plan 04 is complete, we have **two independent services**:
- User Service (authentication)
- Package Service (catalog)

Services can be parallelized from here:
- Plan 05: Order Service (depends on Package Service)
- Plan 06: Customer Service (depends on User Service)
- Plan 07: Message Service (independent)
- Plan 08: Email Service (independent)
- Plan 09: Admin Service (depends on multiple)

We can extract them in any order or in parallel.

---

**Ready to implement?** Let's build Package Service using the proven patterns from User Service!
