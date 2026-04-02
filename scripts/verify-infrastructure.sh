#!/bin/bash

# Verify infrastructure setup for microservices migration
# Checks Docker Compose services and K8s readiness (if applicable)

set -e

echo "=== Travel Agency Infrastructure Verification ==="
echo ""

# Check Docker is available
if command -v docker &> /dev/null; then
  echo "✓ Docker is installed"
else
  echo "❌ Docker not found"
  exit 1
fi

# Check Docker Compose is available
if command -v docker-compose &> /dev/null; then
  echo "✓ Docker Compose is installed"
else
  echo "❌ Docker Compose not found"
  exit 1
fi

# Validate docker-compose.yml
echo ""
echo "Validating docker-compose.yml..."
if docker-compose config &> /dev/null; then
  echo "✓ docker-compose.yml is valid"
else
  echo "❌ docker-compose.yml has errors"
  docker-compose config 2>&1 || true
  exit 1
fi

# Check if .env files exist
echo ""
echo "Checking .env files..."
if [ ! -f .env ]; then
  echo "⚠ Root .env not found. Run 'npm run setup' to generate .env files."
else
  echo "✓ Root .env exists"
fi

missing_env=0
for service in user-service package-service order-service customer-service message-service email-service admin-service gateway; do
  if [ ! -f "$service/.env" ]; then
    echo "⚠ $service/.env not found. Run 'npm run setup'."
    missing_env=$((missing_env + 1))
  fi
done
if [ $missing_env -eq 0 ]; then
  echo "✓ All service .env files exist"
else
  echo "⚠ Missing $missing_env .env files"
fi

# Optionally start services in background and test
read -p "Start Docker Compose services to test connectivity? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Starting services with docker-compose up -d..."
  docker-compose up -d

  echo ""
  echo "Waiting for services to be healthy..."
  sleep 10

  # Test MongoDB connectivity
  echo ""
  echo "Testing MongoDB instances..."
  for port in 27017 27018 27019 27020 27021 27022; do
    if timeout 5 mongosh --host localhost --port $port -u admin -p password --authenticationDatabase admin --eval "db.adminCommand('ping')" &> /dev/null; then
      echo "✓ MongoDB on port $port is ready"
    else
      echo "⚠ MongoDB on port $port not ready (may still be starting)"
    fi
  done

  # Test RabbitMQ
  echo ""
  echo "Testing RabbitMQ..."
  if curl -s -u admin:password http://localhost:15672/api/overview &> /dev/null; then
    echo "✓ RabbitMQ is ready (management UI: http://localhost:15672)"
  else
    echo "⚠ RabbitMQ not ready"
  fi

  # Show running containers
  echo ""
  echo "Running containers:"
  docker-compose ps

  # Optionally stop
  read -p "Stop services after verification? (Y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "Stopping services..."
    docker-compose down
    echo "✓ Services stopped"
  fi
else
  echo ""
  echo "To test manually:"
  echo "  1. docker-compose up -d"
  echo "  2. docker-compose ps"
  echo "  3. mongosh --host localhost --port 27017 -u admin -p password"
  echo "  4. curl -u admin:password http://localhost:15672/api/overview"
  echo "  5. npm run setup  # Generate .env files"
fi

# Check K8s (optional)
echo ""
echo "Checking Kubernetes (optional)..."
if command -v kubectl &> /dev/null; then
  echo "✓ kubectl is installed"
  if kubectl cluster-info &> /dev/null; then
    echo "✓ Connected to K8s cluster: $(kubectl config current-context)"
  else
    echo "⚠ Not connected to a K8s cluster (Docker Desktop K8s, Minikube, or Kind required for K8s deployment)"
  fi
else
  echo "⚠ kubectl not installed (K8s deployment will require it)"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "  1. Ensure all .env files exist: npm run setup"
echo "  2. Start infrastructure: docker-compose up -d (for local) OR ./scripts/apply-k8s.sh (for K8s)"
echo "  3. Verify: ./scripts/verify-k8s.sh or check docker-compose ps"
echo "  4. Proceed to Plan 02: Database Layer"