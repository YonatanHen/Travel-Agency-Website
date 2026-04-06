---
name: Plan 03 Integration Test Fix
description: Next step to fix integration tests failing with 500 errors
type: project
---

## Current Status

Plan 03 (User Service Extraction) has been successfully implemented:

✅ **Completed:**
- All code: routes, services, middleware, models, repositories
- Unit tests: 31/31 passing
- Dependencies installed
- Configuration files updated
- Password exclusion bug fixed in UserRepository

❌ **Blocking Issue:**
Integration tests failing with HTTP 500 errors on sign-up endpoint. The try-catch added to the test should log the error details but output is being truncated/timeout.

## Next Step

Diagnose the 500 error in integration tests:

1. **Run integration test with full error output:**
   ```bash
   npm test --prefix services/user-service --testPathPattern=auth.routes.test.js --no-coverage 2>&1 | tee /tmp/integration.log
   ```

2. **Check the error response body** that the catch block logs to understand the exact error

3. **Common causes to investigate:**
   - Error handling middleware order in app.js (must be AFTER routes)
   - Missing express.json() middleware
   - Validation schema issues
   - Database connection state (isConnected check)
   - Missing environment variables in test mode

4. **Files to review:**
   - `services/user-service/src/app.js` (middleware order, error handler)
   - `services/user-service/src/routes/auth.js` (route handlers)
   - `services/user-service/src/services/UserService.js` (validation, error throwing)
   - `services/user-service/tests/integration/auth.routes.test.js` (test setup)

## Expected Outcome

After fixing the integration tests:
- All tests should pass (unit + integration)
- Coverage should be >70%
- User Service is production-ready with full test coverage

Then proceed to **Plan 04** (next service extraction) per PLANS-INDEX.md.
