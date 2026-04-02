---
name: backend-focus
description: This MERN stack travel agency is being refactored to microservices. Focus exclusively on backend changes: Express services, API Gateway, service-to-service communication, database per service, and infrastructure. Never modify React frontend code in `src/` or `public/`. Only update `package.json` proxy if needed. The React frontend must continue working unchanged through the Gateway. Follow `microservices-refacor-plan.md` Baby Steps.
---

This project is a **backend showcase**. The React frontend is already complete and should not be modified. Your work is entirely on:

- Express.js microservices (extracting from monolith)
- API Gateway configuration
- MongoDB database design (per-service)
- Docker containerization
- Service-to-service API calls
- GitHub Actions CI/CD (not CircleCI)
- Testing (unit + integration + E2E)
- Infrastructure (Kubernetes, health checks, metrics)
- Security (JWT, validation, rate limiting)
- Observability (logging, monitoring)

**Allowed modifications:**
- `package.json` proxy (change from port 3001 → 3000)
- Configuration files (.env.example, docker-compose.yml)
- Anything in `services/`, `gateway/`, `server/` (as it gets extracted)
- `test/` directory
- `.github/` for workflows
- Documentation files

**Never modify:**
- `src/` (React components)
- `public/` (static assets)
- CSS/styling files
- React routing (`src/App.js`)
- Component state management

Follow the Baby Steps in `microservices-refacor-plan.md`. Each service must be production-ready: Dockerized, tested, documented, with health checks and proper error handling.
