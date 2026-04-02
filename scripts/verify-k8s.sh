#!/bin/bash

# Verify K8s infrastructure
set -e

echo "=== Travel Agency Infrastructure Verification ==="
echo ""

# Check namespace
echo "1. Namespace:"
kubectl get namespace travel-agency || { echo "❌ Namespace not found"; exit 1; }
echo "✓ Namespace exists"
echo ""

# Check PVCs
echo "2. PersistentVolumeClaims:"
kubectl get pvc -n travel-agency
echo ""

# Check Secrets
echo "3. Secrets (status):"
kubectl get secrets -n travel-agency
echo ""

# Check ConfigMaps
echo "4. ConfigMaps:"
kubectl get configmaps -n travel-agency
echo ""

# Check Services
echo "5. Services:"
kubectl get svc -n travel-agency
echo ""

# Check Pods
echo "6. Pods:"
kubectl get pods -n travel-agency
echo ""

# Check StatefulSets
echo "7. StatefulSets:"
kubectl get statefulset -n travel-agency
echo ""

# Check Deployments
echo "8. Deployments:"
kubectl get deployments -n travel-agency
echo ""

# Check Ingress
echo "9. Ingress:"
kubectl get ingress -n travel-agency || echo "No ingress defined yet"
echo ""

# Connectivity tests (if pods are ready)
echo "10. Connectivity Tests:"
echo "Testing RabbitMQ management API..."
 kubectl run -i --tty --rm connectivity-test --image=curlimages/curl:latest -n travel-agency -- \
  "curl -s -u admin:$(kubectl get secret rabbitmq-secrets -n travel-agency -o jsonpath='{.data.RABBITMQ_DEFAULT_PASS}' | base64 -d) http://rabbitmq:15672/api/overview" \
  && echo "✓ RabbitMQ API reachable" || echo "❌ RabbitMQ API not reachable (pods may not be ready)"

echo ""
echo "=== Verification Complete ==="
echo ""
echo "If any issues:"
echo "  - Check pod logs: kubectl logs <pod-name> -n travel-agency"
echo "  - Describe pod: kubectl describe pod <pod-name> -n travel-agency"
echo "  - Check events: kubectl get events -n travel-agency --sort-by='.lastTimestamp'"