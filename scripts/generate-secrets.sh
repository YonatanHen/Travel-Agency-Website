#!/bin/bash

# Generate random secrets and apply to K8s cluster
# Usage: ./scripts/generate-secrets.sh

set -e

echo "Generating random secrets..."

# Generate random passwords
MONGODB_USER_PASSWORD=$(openssl rand -base64 32)
MONGODB_PACKAGE_PASSWORD=$(openssl rand -base64 32)
MONGODB_ORDER_PASSWORD=$(openssl rand -base64 32)
MONGODB_CUSTOMER_PASSWORD=$(openssl rand -base64 32)
MONGODB_MESSAGE_PASSWORD=$(openssl rand -base64 32)
MONGODB_ADMIN_PASSWORD=$(openssl rand -base64 32)
RABBITMQ_COOKIE=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# Create secrets YAML
cat > k8s/secrets.auto.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secrets
  namespace: travel-agency
type: Opaque
stringData:
  MONGODB_PASSWORD_USER: "${MONGODB_USER_PASSWORD}"
  MONGODB_PASSWORD_PACKAGE: "${MONGODB_PACKAGE_PASSWORD}"
  MONGODB_PASSWORD_ORDER: "${MONGODB_ORDER_PASSWORD}"
  MONGODB_PASSWORD_CUSTOMER: "${MONGODB_CUSTOMER_PASSWORD}"
  MONGODB_PASSWORD_MESSAGE: "${MONGODB_MESSAGE_PASSWORD}"
  MONGODB_PASSWORD_ADMIN: "${MONGODB_ADMIN_PASSWORD}"
  RABBITMQ_ERLANG_COOKIE: "${RABBITMQ_COOKIE}"
---
apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-secrets
  namespace: travel-agency
type: Opaque
stringData:
  RABBITMQ_DEFAULT_USER: "admin"
  RABBITMQ_DEFAULT_PASS: "$(openssl rand -base64 20)"
  RABBITMQ_ERLANG_COOKIE: "${RABBITMQ_COOKIE}"
EOF

echo "Applying secrets to cluster..."
kubectl apply -f k8s/secrets.auto.yaml

echo "Secrets created successfully!"
echo ""
echo "Important: Save these values to regenerate if cluster is lost:"
echo "MONGODB_USER_PASSWORD: $MONGODB_USER_PASSWORD"
echo "MONGODB_PACKAGE_PASSWORD: $MONGODB_PACKAGE_PASSWORD"
echo "MONGODB_ORDER_PASSWORD: $MONGODB_ORDER_PASSWORD"
echo "MONGODB_CUSTOMER_PASSWORD: $MONGODB_CUSTOMER_PASSWORD"
echo "MONGODB_MESSAGE_PASSWORD: $MONGODB_MESSAGE_PASSWORD"
echo "MONGODB_ADMIN_PASSWORD: $MONGODB_ADMIN_PASSWORD"
echo "RABBITMQ_COOKIE: $RABBITMQ_COOKIE"
echo "JWT_SECRET: $JWT_SECRET"