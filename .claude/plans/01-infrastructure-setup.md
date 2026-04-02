# Plan 01: Infrastructure Setup (Kubernetes-First)

**Phase**: 0 - Infrastructure
**Estimated Time**: 3-4 hours
**Dependencies**: None (first step)

---

## AI Context

**What**: Create monorepo structure, Kubernetes manifests for all services + RabbitMQ + MongoDB, workspace configuration, and environment management.

**Why**: Foundation for microservices. All subsequent plans depend on this scaffolding. Kubernetes is the primary deployment target (not Docker Compose).

**Output**:
- `services/`, `gateway/`, `frontend/`, `shared/` directories
- K8s manifests: Deployments, Services, ConfigMaps, Secrets, Ingress, PVCs
- Namespace, network policies
- Namespace: `travel-agency`
- rabbitmq: 3-node cluster (HA) or single node for dev
- MongoDB: 6 StatefulSets (one per service) OR 1 cluster with 6 databases
- Workspace config with Lerna
- Base Dockerfile templates
- Environment templates per service

**Dependencies**: None

**Important**: This plan uses **Kubernetes** as the primary orchestrator. For local development without K8s cluster, you can use Docker Compose or Minikube/Kind. K8s manifests will work on any K8s cluster (minikube, Docker Desktop K8s, AWS EKS, GKE, AKS).

---

## Human Summary (Quick Read)

### What This Plan Does
- ✅ Creates monorepo with 7 services + gateway + frontend + shared libs
- ✅ Generates Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets)
- ✅ Configures RabbitMQ cluster (3 nodes for HA, or 1 node for simplicity)
- ✅ Configures 6 MongoDB StatefulSets (or 1 cluster with 6 DBs)
- ✅ Sets up network policies and service discovery
- ✅ Creates npm workspaces + Lerna
- ✅ Builds shared config/error packages
- ✅ Generates `.env` templates (for Docker/local dev only; K8s uses Secrets)

### Key Decisions
- **Orchestrator**: Kubernetes (primary) - portfolios love K8s
- **Message Queue**: RabbitMQ cluster (3 nodes for HA, impressive for portfolio)
- **Databases**: Option A: 6 MongoDB StatefulSets (fully isolated) OR Option B: 1 MongoDB cluster with 6 separate databases (simpler, still isolated at DB level)
- **Networking**: K8s Services (ClusterIP for internal, LoadBalancer/Ingress for external)
- **Namespace**: `travel-agency` (isolates all resources)
- **Secrets**: K8s Secrets from base64-encoded values (or integrate with external secret manager)
- **Storage**: PersistentVolumeClaims for MongoDB and RabbitMQ (data survives pod restarts)

### Things to Know
- **Recommended for portfolio**: K8s shows advanced DevOps skills
- **Local Dev Options**:
  1. Docker Desktop with K8s enabled (easiest)
  2. Minikube (free, lightweight)
  3. Kind (K8s in Docker)
  4. Docker Compose (fallback - see alternative at end)
- **Port Forwarding**: Use `kubectl port-forward` to access services locally
- **RabbitMQ UI**: `kubectl port-forward svc/rabbitmq 15672:15672` → http://localhost:15672

---

## Architecture Diagram (K8s)

```
Namespace: travel-agency

┌────────────────────────────────────────────────────────────┐
│                         INGRESS                             │
│         (nginx/alb/gateway - port 80/443)                  │
└──────────────┬─────────────────────────────┬───────────────┘
               │                             │
               ▼                             ▼
    ┌──────────────────┐         ┌────────────────────┐
    │   GATEWAY        │         │   FRONTEND         │
    │   Deployment     │         │   Deployment       │
    │   Service        │         │   Service          │
    │   (ClusterIP)    │         │   (ClusterIP)      │
    └────────┬─────────┘         └─────────┬──────────┘
             │                               │
             └───────────┬───────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  USER       │ │  PACKAGE    │ │  ORDER      │
│  Service    │ │  Service    │ │  Service    │
│  + MongoDB  │ │  + MongoDB  │ │  + MongoDB  │
└─────────────┘ └─────────────┘ └─────────────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │    RABBITMQ      │
              │   (3-node)       │
              │   + Management   │
              └──────────────────┘

Each Service + DB gets:
- Deployment (replicas: 1 for dev, 3 for prod)
- Service (ClusterIP)
- PVC (for data persistence)
- ConfigMap (env vars)
- Secret (sensitive data)
```

---

## Detailed Steps

### Task 01-01: Create Monorepo Directory Structure

**Steps**:
1. Create directories:
```bash
mkdir -p services/{user-service,package-service,order-service,customer-service,message-service,email-service,admin-service}
mkdir gateway frontend shared/config shared/errors shared/middleware shared/utils scripts k8s/{base,overlays} docs
```

2. Move frontend:
```bash
mv src frontend/
mv public frontend/
```

3. Create placeholder files:
   - Each service: `README.md`, `.env.example`, `package.json`
   - Gateway: same
   - Frontend: `Dockerfile`, `.env.example`
   - Shared packages: `package.json`

4. Update `.gitignore`:
```
# Services
services/**/node_modules
services/**/.env
services/**/coverage
services/**/logs

# Gateway
gateway/node_modules
gateway/.env

# Frontend
frontend/.env
frontend/build/
frontend/node_modules

# K8s
k8s/.local/
k8s/secrets.yaml

# IDE
.vscode/
.idea/
*.swp
.DS_Store
```

**Files**:
- Create all directories
- Move: `src/` → `frontend/src/`, `public/` → `frontend/public/`
- Create: placeholder `README.md`, `.env.example`, `package.json` in each service and gateway

---

### Task 01-02: Configure NPM Workspaces + Lerna

**Steps**: (same as previous version)

Update root `package.json` and create `lerna.json`.

**Files**:
- Modify: `package.json`
- Create: `lerna.json`

---

### Task 01-03: Kubernetes Manifests - Base Templates

**Steps**:

Create `k8s/base/` directory with YAML templates:

1. **Namespace** (`k8s/base/00-namespace.yaml`):
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: travel-agency
  labels:
    name: travel-agency
```

2. **ConfigMap template** (`k8s/base/configmap.yaml`):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{SERVICE_NAME}}-config
  namespace: travel-agency
data:
  NODE_ENV: "production"
  PORT: "3000"
  SERVICE_NAME: {{SERVICE_NAME}}
  MONGODB_URL: "mongodb://{{SERVICE_NAME}}-mongodb.travel-agency.svc.cluster.local:27017"
  DATABASE_NAME: "{{SERVICE_NAME}}_db"
  RABBITMQ_URL: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq.travel-agency.svc.cluster.local:5672"
  # Service URLs will be injected via kustomize or helm
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-config
  namespace: travel-agency
data:
  NODE_ENV: "production"
  PORT: "3000"
  SERVICE_NAME: "gateway"
  RABBITMQ_URL: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq.travel-agency.svc.cluster.local:5672"
  # Downstream service URLs
  USER_SERVICE_URL: "http://user-service:3001"
  PACKAGE_SERVICE_URL: "http://package-service:3002"
  ORDER_SERVICE_URL: "http://order-service:3003"
  CUSTOMER_SERVICE_URL: "http://customer-service:3004"
  MESSAGE_SERVICE_URL: "http://message-service:3005"
  EMAIL_SERVICE_URL: "http://email-service:3006"
  ADMIN_SERVICE_URL: "http://admin-service:3007"
```

3. **Secrets template** (`k8s/base/secrets.yaml`):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{SERVICE_NAME}}-secrets
  namespace: travel-agency
type: Opaque
stringData:
  # Values will be populated from environment or external secret manager
  JWT_SECRET: "change-me-in-production"
  MONGODB_PASSWORD: "mongodb-password-here"
  RABBITMQ_PASSWORD: "rabbitmq-password-here"
  SENDGRID_API_KEY: "your-sendgrid-key"
  FROM_EMAIL: "noreply@example.com"
---
apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-secrets
  namespace: travel-agency
type: Opaque
stringData:
  RABBITMQ_DEFAULT_USER: "admin"
  RABBITMQ_DEFAULT_PASS: "your-rabbitmq-password-here"
```

**Note**: Replace `change-me` values with actual secrets before applying. Consider using sealed-secrets or external secret manager (AWS Secrets Manager, HashiCorp Vault) for production.

4. **Service template** (`k8b/base/service.yaml`):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{SERVICE_NAME}}
  namespace: travel-agency
  labels:
    app: {{SERVICE_NAME}}
spec:
  selector:
    app: {{SERVICE_NAME}}
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: {{SERVICE_NAME}}-mongodb
  namespace: travel-agency
  labels:
    app: {{SERVICE_NAME}}-mongodb
spec:
  selector:
    app: {{SERVICE_NAME}}-mongodb
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
  type: ClusterIP
```

5. **Deployment template** (`k8s/base/deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{SERVICE_NAME}}
  namespace: travel-agency
  labels:
    app: {{SERVICE_NAME}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
    spec:
      containers:
        - name: {{SERVICE_NAME}}
          image: {{IMAGE_REGISTRY}}/{{SERVICE_NAME}}:{{IMAGE_TAG}}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: {{SERVICE_NAME}}-config
            - secretRef:
                name: {{SERVICE_NAME}}-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{SERVICE_NAME}}-mongodb
  namespace: travel-agency
  labels:
    app: {{SERVICE_NAME}}-mongodb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}-mongodb
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}-mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:6
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              value: "admin"
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-secrets
                  key: MONGODB_PASSWORD
          volumeMounts:
            - name: data
              mountPath: /data/db
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          readinessProbe:
            exec:
              command:
                - mongosh
                - --username
                - admin
                - --password
                - $(MONGO_INITDB_ROOT_PASSWORD)
                - --authenticationDatabase
                - admin
                - --eval
                - "db.adminCommand('ping')"
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: {{SERVICE_NAME}}-mongodb-pvc
```

6. **PersistentVolumeClaim template** (`k8s/base/pvc.yaml`):
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{SERVICE_NAME}}-mongodb-pvc
  namespace: travel-agency
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard  # Change based on your K8s cluster (standard, gp2, etc.)
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{SERVICE_NAME}}-pvc
  namespace: travel-agency
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard
```

7. **Gateway Ingress** (`k8s/base/ingress.yaml`):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  namespace: travel-agency
  annotations:
    kubernetes.io/ingress.class: nginx
    # For AWS ALB: alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - host: travel.localhost  # Change to your domain
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gateway
                port:
                  number: 3000
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: gateway
                port:
                  number: 3000
```

**Files**:
- Create: `k8s/base/*.yaml` (namespace, configmap, secrets, service, deployment, pvc, ingress)

---

### Task 01-04: Generate Service-Specific Manifests with Kustomize

**Steps**:

Use Kustomize (built into `kubectl`) to generate service-specific manifests:

1. Create `k8s/services/` directory:
```bash
mkdir -p k8s/services/{user-service,package-service,order-service,customer-service,message-service,email-service,admin-service,gateway,rabbitmq}
```

2. For each service, create `kustomization.yaml`:

**Example: `k8s/services/user-service/kustomization.yaml`**:
```yaml
namespace: travel-agency

namePrefix: user-

commonLabels:
  app: user-service
  version: v1

configMapGenerator:
  - name: user-config
    behavior: merge
    literals:
      - NODE_ENV=production
      - PORT=3000
      - SERVICE_NAME=user-service
      - MONGODB_URL=mongodb://user-mongodb.travel-agency.svc.cluster.local:27017
      - DATABASE_NAME=user_service_db
      - RABBITMQ_URL=amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq.travel-agency.svc.cluster.local:5672
      - JWT_SECRET=$(JWT_SECRET)  # From secret

secretGenerator:
  - name: user-secrets
    literals:
      - JWT_SECRET=change-me
    options:
      disableNameSuffixHash: true

bases:
  - ../../base/configmap.yaml
  - ../../base/secrets.yaml
  - ../../base/service.yaml
  - ../../base/deployment.yaml
  - ../../base/pvc.yaml

patchesStrategicMerge:
  - patches/user-deployment-patch.yaml
  - patches/user-service-patch.yaml
```

3. Create patches for each service to customize base templates:

**`k8s/services/user-service/patches/user-deployment-patch.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user
spec:
  template:
    spec:
      containers:
        - name: user
          image: travel-agency/user-service:latest
```

**`k8s/services/user-service/patches/user-service-patch.yaml`**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: user
spec:
  selector:
    app: user
```

4. Repeat for each service (or generate programmatically with script).

5. Create `k8s/services/rabbitmq/kustomization.yaml` for RabbitMQ cluster:

```yaml
namespace: travel-agency
namePrefix: rabbitmq-

commonLabels:
  app: rabbitmq
  component: rabbitmq

bases:
  - ../../base/service.yaml
  - ../../base/deployment.yaml
  - ../../base/pvc.yaml

patchesStrategicMerge:
  - patches/rabbitmq-deployment.yaml
  - patches/rabbitmq-service.yaml

# RabbitMQ StatefulSet for clustering
configMapGenerator:
  - name: rabbitmq-config
    files:
      - rabbitmq.conf
```

**`k8s/services/rabbitmq/patches/rabbitmq-deployment.yaml`**:
```yaml
apiVersion: apps/v1
kind: StatefulSet  # Changed from Deployment to StatefulSet for clustering
metadata:
  name: rabbitmq
spec:
  serviceName: rabbitmq
  replicas: 3  # HA cluster
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
        - name: rabbitmq
          image: rabbitmq:3-management
          ports:
            - containerPort: 5672
              name: amqp
            - containerPort: 15672
              name: management
          env:
            - name: RABBITMQ_NODENAME
              value: rabbitmq@$(MY_POD_NAME).rabbitmq.travel-agency.svc.cluster.local
            - name: RABBITMQ_USE_LONGNAME
              value: "true"
            - name: RABBITMQ_ERLANG_COOKIE
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secrets
                  key: RABBITMQ_ERLANG_COOKIE
          volumeMounts:
            - name: rabbitmq-data
              mountPath: /var/lib/rabbitmq
          readinessProbe:
            exec:
              command:
                - rabbitmq-diagnostics
                - ping
            initialDelaySeconds: 10
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: rabbitmq-data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        resources:
          requests:
            storage: 5Gi
        storageClassName: standard
```

**Files**:
- Create: `k8s/services/*/kustomization.yaml` (8 files)
- Create: `k8s/services/*/patches/*.yaml` (patches per service)
- Create: `k8s/services/rabbitmq/rabbitmq.conf` (config)

---

### Task 01-05: MongoDB External or K8s?

**AI Context**: Critical decision point: Run MongoDB in K8s or use managed/external?

**Options**:

**Option A - MongoDB in K8s** (simpler for dev, complete isolation):
- Deploy 6 MongoDB StatefulSets (or 1 cluster with 6 DBs)
- Pros: Everything in K8s, isolated, easy deletion
- Cons: Data loss on cluster delete (unless backups), not production-grade

**Option B - External MongoDB** (recommended for real production):
- Use managed MongoDB Atlas (free tier available)
- Or standalone MongoDB server outside K8s
- Pros: Production-ready, backups, HA
- Cons: External dependency, network latency

**For Portfolio**: Show both options but implement **Option A for development** with K8s StatefulSets. Mention in README that production would use managed DB.

**Decision**: Implement Option A (all in K8s) for this migration.

**Steps**:

1. Create `k8s/base/mongodb-statefulset.yaml` (template for all DBs):
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{SERVICE_NAME}}-mongodb
  namespace: travel-agency
spec:
  serviceName: {{SERVICE_NAME}}-mongodb
  replicas: 1
  selector:
    matchLabels:
      app: {{SERVICE_NAME}}-mongodb
  template:
    metadata:
      labels:
        app: {{SERVICE_NAME}}-mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:6
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              value: "admin"
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-secrets
                  key: MONGODB_PASSWORD_{{SERVICE_NAME | upper}}
          volumeMounts:
            - name: data
              mountPath: /data/db
          readinessProbe:
            exec:
              command:
                - mongosh
                - --username
                - admin
                - --password
                - $(MONGO_INITDB_ROOT_PASSWORD)
                - --authenticationDatabase
                - admin
                - --eval
                - "db.adminCommand('ping')"
            initialDelaySeconds: 5
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        resources:
          requests:
            storage: 5Gi
        storageClassName: standard
```

2. Create `k8s/base/mongodb-service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{SERVICE_NAME}}-mongodb
  namespace: travel-agency
spec:
  selector:
    app: {{SERVICE_NAME}}-mongodb
  ports:
    - port: 27017
      targetPort: 27017
  clusterIP: None  # Headless service for StatefulSet
```

3. Create `k8s/base/mongodb-secrets.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secrets
  namespace: travel-agency
type: Opaque
stringData:
  # Generate random passwords with: openssl rand -base64 32
  MONGODB_PASSWORD_USER: "user-db-password"
  MONGODB_PASSWORD_PACKAGE: "package-db-password"
  MONGODB_PASSWORD_ORDER: "order-db-password"
  MONGODB_PASSWORD_CUSTOMER: "customer-db-password"
  MONGODB_PASSWORD_MESSAGE: "message-db-password"
  MONGODB_PASSWORD_ADMIN: "admin-db-password"
  RABBITMQ_ERLANG_COOKIE: "change-me-to-secure-random-string"
```

**Generate real secrets**:
```bash
# scripts/generate-secrets.sh
#!/bin/bash
kubectl create secret generic mongodb-secrets \
  --namespace travel-agency \
  --from-literal=MONGODB_PASSWORD_USER=$(openssl rand -base64 32) \
  --from-literal=MONGODB_PASSWORD_PACKAGE=$(openssl rand -base64 32) \
  --from-literal=MONGODB_PASSWORD_ORDER=$(openssl rand -base64 32) \
  --from-literal=MONGODB_PASSWORD_CUSTOMER=$(openssl rand -base64 32) \
  --from-literal=MONGODB_PASSWORD_MESSAGE=$(openssl rand -base64 32) \
  --from-literal=MONGODB_PASSWORD_ADMIN=$(openssl rand -base64 32) \
  --from-literal=RABBITMQ_ERLANG_COOKIE=$(openssl rand -base64 32) \
  --dry-run=client -o yaml
```

**Files**:
- Create: `k8s/base/mongodb-statefulset.yaml`
- Create: `k8s/base/mongodb-service.yaml`
- Create: `k8s/base/mongodb-secrets.yaml` (template with placeholders)
- Create: `scripts/generate-secrets.sh`

---

### Task 01-06: Apply Manifests to Cluster

**Steps**:

1. **Check K8s cluster** (choose one):
   - Docker Desktop: Enable Kubernetes in settings
   - Minikube: `minikube start --memory=8192 --cpus=4`
   - Kind: `kind create cluster`
   - Remote cluster: `kubectl config use-context <cluster>`

2. **Create namespace**:
```bash
kubectl apply -f k8s/base/00-namespace.yaml
```

3. **Create secrets** (update with real values first):
```bash
# Edit k8s/base/mongodb-secrets.yaml with actual random passwords
# Or use: scripts/generate-secrets.sh | kubectl apply -f -

kubectl apply -f k8s/base/mongodb-secrets.yaml
kubectl apply -f k8s/base/secrets.yaml
```

4. **Create RabbitMQ**:
```bash
kubectl apply -k k8s/services/rabbitmq
# Wait for pods
kubectl wait --for=condition=ready pod -l app=rabbitmq -n travel-agency --timeout=300s
```

5. **Create ConfigMaps**:
```bash
kubectl apply -k k8s/base/configmap.yaml
```

6. **Create MongoDB StatefulSets** (for all 6 services):
```bash
for service in user package order customer message admin; do
  kubectl apply -k k8s/services/${service}-service
done

# Wait for all MongoDB pods
kubectl wait --for=condition=ready pod -l app=user-mongodb -n travel-agency --timeout=300s
# ... repeat for each
```

7. **Verify**:
```bash
kubectl get all -n travel-agency
# Should show: pods, services, statefulsets, pvc, configmaps, secrets

kubectl get pods -n travel-agency
# All should be Running or Completed

# Check RabbitMQ management UI
kubectl port-forward svc/rabbitmq 15672:15672 -n travel-agency
# Open http://localhost:15672 (admin / your-password)

# Check MongoDB connectivity from within pod
kubectl exec -it deploy/user-mongodb -n travel-agency -- mongosh -u admin -p $(kubectl get secret mongodb-secrets -n travel-agency -o jsonpath="{.data.MONGODB_PASSWORD_USER}" | base64 -d) --authenticationDatabase admin --eval "show dbs"
```

8. **Create Gateway Ingress**:
```bash
kubectl apply -f k8s/base/ingress.yaml
# Get ingress IP
kubectl get ingress -n travel-agency
# Update /etc/hosts to point travel.localhost to ingress IP
```

**Acceptance Criteria**:
- [ ] All pods in `travel-agency` namespace are Running
- [ ] All services have ClusterIP assigned
- [ ] All PVCs are Bound (data persisted)
- [ ] RabbitMQ management UI accessible
- [ ] MongoDB pods accept connections
- [ ] `kubectl get all -n travel-agency` shows complete topology
- [ ] Gateway ingress created (even if pods not ready yet)

**Files** (already created):
- All `k8s/**/*.yaml` files

**Test**:
```bash
# Comprehensive check
kubectl get all,configmap,secret,pvc,ingress -n travel-agency -o wide

# Connectivity test
kubectl run -i --tty --rm debug --image=busybox:latest -n travel-agency --restart=Never -- sh
# Inside pod:
# wget -qO- http://user-service:3000/health  # Should return JSON
# wget -qO- http://rabbitmq:15672/api/overview  # Should return JSON
```

---

## After This Plan

You'll have:
- Complete K8s deployment with all services defined
- RabbitMQ cluster (3 nodes) running
- 6 MongoDB StatefulSets with PVCs
- ConfigMaps and Secrets managed
- Ingress for external access
- Ready to deploy service code

---

## Next Plan

**Plan 02: Database Layer** - Define Mongoose schemas, create BaseRepository pattern, connection utilities.

---

## Alternative: Docker Compose (Quick Local Dev)

If you don't have a K8s cluster, create `docker-compose.yml`:

```yaml
version: '3.8'

networks:
  travel-network:

volumes:
  mongo-user-data:
  mongo-package-data:
  rabbitmq-data:

services:
  mongo-user:
    image: mongo:6
    container_name: mongo-user
    ports: ["27017:27017"]
    volumes: [mongo-user-data:/data/db]
    networks: [travel-network]
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  mongo-package:
    image: mongo:6
    container_name: mongo-package
    ports: ["27018:27017"]
    volumes: [mongo-package-data:/data/db]
    networks: [travel-network]
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports: ["5672:5672", "15672:15672"]
    volumes: [rabbitmq-data:/var/lib/rabbitmq]
    networks: [travel-network]
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password

  # Services will be added as they're built
```

Start: `docker-compose up -d`

---

## Troubleshooting

**PVC stuck in Pending**:
- Check storage class exists: `kubectl get storageclass`
- Set `storageClassName: ""` to use default

**Pod CrashLoopBackOff**:
- Check logs: `kubectl logs <pod-name> -n travel-agency`
- Check secret references (common issue)

**Connection refused from service to DB**:
- Verify service names: `<service>-mongodb.travel-agency.svc.cluster.local`
- Check NetworkPolicy (if defined)

**RabbitMQ cluster not forming**:
- Ensure `RABBITMQ_ERLANG_COOKIE` is same in all pods (from same Secret)
- Check pod hostnames match expected cluster naming

---

## Quick Reference

| Resource | Namespace | Type | Replicas |
|----------|-----------|------|----------|
| MongoDB | travel-agency | StatefulSet | 1 per service (6 total) |
| RabbitMQ | travel-agency | StatefulSet | 3 (HA) |
| Services | travel-agency | Deployment | 1 (dev) / 3 (prod) |
| PVCs | travel-agency | PersistentVolumeClaim | Auto-created |

**Port Forwarding (local access)**:
```bash
kubectl port-forward svc/gateway 3000:3000 -n travel-agency  # Gateway
kubectl port-forward svc/rabbitmq 15672:15672 -n travel-agency  # RabbitMQ UI
kubectl port-forward svc/user-mongodb 27017:27017 -n travel-agency  # User DB
```

---

**Auto-Mode**: ⚠️ **Not fully autonomous**. Requires K8s cluster availability. Steps require sequential application and verification. User should have cluster ready (Minikube/Docker Desktop K8s). If cluster not available, plan should pause and ask user to provision cluster first.
