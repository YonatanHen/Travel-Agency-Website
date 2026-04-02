---
name: cicd-github-actions
description: Set up GitHub Actions for CI/CD. Run tests, linting, Docker builds on push/PR. Archive test results, code coverage, and build artifacts. Use matrix strategy for multiple services.
---

This project uses **GitHub Actions**, not CircleCI (the old config.yml can be removed or repurposed).

## Workflow Structure

Place workflows in `.github/workflows/`.

### tests.yml
Run tests for all services on PR/push to main/develop.

```yaml
name: Tests

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ user-service, package-service, order-service, customer-service, communication-service, gateway ]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd services/${{ matrix.service }}
          npm ci

      - name: Lint
        run: |
          cd services/${{ matrix.service }}
          npm run lint

      - name: Unit & Integration Tests
        run: |
          cd services/${{ matrix.service }}
          npm test
        env:
          MONGODB_URI: mongodb://localhost:27017
          DATABASE_NAME: ${{ matrix.service }}_test
          NODE_ENV: test
        services:
          mongodb:
            image: mongo:5.0
            ports:
              - 27017:27017
            options: --health-cmd "mongosh --eval 'db.runCommand(\"ping\").ok'" --health-interval 10s --health-timeout 5s --health-retries 5

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.service }}
          path: |
            services/${{ matrix.service }}/test-results/
            services/${{ matrix.service }}/coverage/
```

### docker-build.yml
Build and push Docker images when tests pass.

```yaml
name: Docker Build

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ user-service, package-service, order-service, customer-service, communication-service, gateway ]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: services/${{ matrix.service }}
          file: services/${{ matrix.service }}/Dockerfile
          push: true
          tags: |
            yourusername/${{ matrix.service }}:latest
            yourusername/${{ matrix.service }}:${{ github.sha }}
          cache-from: type=registry,ref=yourusername/${{ matrix.service }}:buildcache
          cache-to: type=registry,ref=yourusername/${{ matrix.service }}:buildcache,mode=max
```

### deploy.yml (optional - Kubernetes)
Deploy to cluster when new image is pushed.

```yaml
name: Deploy

on:
  push:
    tags: [ 'v*' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f deployments/k8s/
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
```

## Composite Actions (Optional)

Create reusable composite actions in `.github/actions/` for common tasks:
- `setup-node-and-db` - installs Node.js and starts MongoDB service
- `run-tests` - standard test step with environment
- `build-docker` - standard build-and-push

## Artifacts and Coverage

- Upload test results (JUnit XML) as artifacts
- Upload coverage reports (use `actions/upload-artifact@v4`)
- Publish coverage to Codecov or Coveralls if desired:
  ```yaml
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      file: services/${{ matrix.service }}/coverage/coverage-final.json
  ```

## Required Secrets

In GitHub repo Settings → Secrets and variables → Actions:
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub access token
- `KUBECONFIG` - Base64 encoded kubeconfig (for deploy)

## Matrix Strategy

Use matrix to run jobs in parallel for each service. This is faster and isolates failures. Jobs should be independent; no job depends on another unless it's the deploy job depending on build.

## Caching

Use `actions/cache` to cache npm dependencies:
```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: services/${{ matrix.service }}/node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('services/${{ matrix.service }}/package-lock.json') }}
```

Delete `.circleci/` directory once GitHub Actions are confirmed working.
