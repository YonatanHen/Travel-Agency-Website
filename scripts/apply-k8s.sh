#!/bin/bash

# Apply all K8s manifests in order
set -e

echo "=== Travel Agency Microservices K8s Deployment ==="
echo ""

# Check kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo "Error: kubectl not found. Please install kubectl."
  exit 1
fi

# Check cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
  echo "Error: Cannot connect to Kubernetes cluster."
  echo "Make sure you have:"
  echo "  - Docker Desktop with K8s enabled, or"
  echo "  - Minikube running (minikube start), or"
  echo "  - Kind cluster (kind create cluster)"
  exit 1
fi

echo "✓ Connected to cluster"

# Apply namespace
echo "Creating namespace..."
kubectl apply -f k8s/base/00-namespace.yaml

echo "Generating secrets (this will create new random passwords)..."
./scripts/generate-secrets.sh

# Apply ConfigMaps
echo "Applying ConfigMaps..."
kubectl apply -k k8s/base/configmap.yaml
kubectl apply -k k8s/base/secrets.yaml

# Apply RabbitMQ first (other services depend on it)
echo "Deploying RabbitMQ..."
kubectl apply -k k8s/services/rabbitmq

# Wait for RabbitMQ to be ready
echo "Waiting for RabbitMQ to be ready..."
kubectl wait --for=condition=ready pod -l app=rabbitmq -n travel-agency --timeout=300s

# Apply MongoDB StatefulSets for all services
echo "Deploying MongoDB instances..."
for service in user package order customer message admin; do
  echo "  - ${service}-mongodb"
  kubectl apply -k "k8s/services/${service}-service" --selector="app=${service}-mongodb"
done

# Wait for all MongoDB pods
echo "Waiting for MongoDB pods to be ready..."
for service in user package order customer message admin; do
  kubectl wait --for=condition=ready pod -l app="${service}-mongodb" -n travel-agency --timeout=300s || true
done

# Apply services (without waiting, they'll start after DBs)
echo "Deploying backend services..."
for service in user-service package-service order-service customer-service message-service email-service admin-service; do
  echo "  - $service"
  kubectl apply -k "k8s/services/${service}"
done

# Apply gateway
echo "Deploying API Gateway..."
kubectl apply -k k8s/services/gateway

# Summary
echo ""
echo "=== Deployment Summary ==="
kubectl get all -n travel-agency

echo ""
echo "Next steps:"
echo "1. Wait for all pods to be Running: kubectl get pods -n travel-agency -w"
echo "2. Port-forward gateway: kubectl port-forward svc/gateway 3000:3000 -n travel-agency"
echo "3. Access RabbitMQ UI: kubectl port-forward svc/rabbitmq 15672:15672 -n travel-agency"
echo "   Username: admin, Password: (see secrets above)"
echo ""
echo "To deploy frontend later, create gateway deployment patch to include frontend static files."