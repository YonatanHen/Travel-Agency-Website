const fs = require('fs');
const path = require('path');

// Services configuration
const services = [
  { name: 'user-service', port: 3001 },
  { name: 'package-service', port: 3002 },
  { name: 'order-service', port: 3003 },
  { name: 'customer-service', port: 3004 },
  { name: 'message-service', port: 3005 },
  { name: 'email-service', port: 3006 },
  { name: 'admin-service', port: 3007 },
];

// Helper to create directory
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Base directory
const baseDir = 'k8s';

// Clean old structure
if (fs.existsSync(path.join(baseDir, 'base'))) {
  fs.rmSync(path.join(baseDir, 'base'), { recursive: true, force: true });
}
if (fs.existsSync(path.join(baseDir, 'services'))) {
  fs.rmSync(path.join(baseDir, 'services'), { recursive: true, force: true });
}

// Create new directories
ensureDir(path.join(baseDir, 'namespace'));
ensureDir(path.join(baseDir, 'configmaps'));
ensureDir(path.join(baseDir, 'secrets'));
ensureDir(path.join(baseDir, 'services'));
ensureDir(path.join(baseDir, 'deployments'));
ensureDir(path.join(baseDir, 'statefulsets'));
ensureDir(path.join(baseDir, 'pvc'));
ensureDir(path.join(baseDir, 'ingress'));
ensureDir(path.join(baseDir, 'rabbitmq'));

// 1. Namespace
fs.writeFileSync(path.join(baseDir, 'namespace', 'travel-agency.yaml'), `apiVersion: v1
kind: Namespace
metadata:
  name: travel-agency
  labels:
    name: travel-agency
    environment: development
`);

// 2. Global Secrets
fs.writeFileSync(path.join(baseDir, 'secrets', 'mongodb-secrets.yaml'), `apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secrets
  namespace: travel-agency
type: Opaque
stringData:
  MONGODB_PASSWORD_USER: "user-db-password"
  MONGODB_PASSWORD_PACKAGE: "package-db-password"
  MONGODB_PASSWORD_ORDER: "order-db-password"
  MONGODB_PASSWORD_CUSTOMER: "customer-db-password"
  MONGODB_PASSWORD_MESSAGE: "message-db-password"
  MONGODB_PASSWORD_ADMIN: "admin-db-password"
  RABBITMQ_ERLANG_COOKIE: "change-me-erlang-cookie-secure"
`);
fs.writeFileSync(path.join(baseDir, 'secrets', 'rabbitmq-secrets.yaml'), `apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-secrets
  namespace: travel-agency
type: Opaque
stringData:
  RABBITMQ_DEFAULT_USER: "admin"
  RABBITMQ_DEFAULT_PASS: "change-me-rabbitmq-password"
  RABBITMQ_ERLANG_COOKIE: "change-me-erlang-cookie-secure"
`);

// 3. Ingress
fs.writeFileSync(path.join(baseDir, 'ingress', 'gateway-ingress.yaml'), `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  namespace: travel-agency
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: travel.localhost
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
`);

// 4. RabbitMQ resources
fs.writeFileSync(path.join(baseDir, 'rabbitmq', 'configmap.yaml'), `apiVersion: v1
kind: ConfigMap
metadata:
  name: rabbitmq-config
  namespace: travel-agency
data:
  rabbitmq.conf: |
    loopback_users.guest = false
    management.tcp.port = 15672
    management.listener.port = 15672
    management.listener.ssl = false
`);
fs.writeFileSync(path.join(baseDir, 'rabbitmq', 'statefulset.yaml'), `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
  namespace: travel-agency
spec:
  serviceName: rabbitmq
  replicas: 3
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
            - name: RABBITMQ_DEFAULT_USER
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secrets
                  key: RABBITMQ_DEFAULT_USER
            - name: RABBITMQ_DEFAULT_PASS
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secrets
                  key: RABBITMQ_DEFAULT_PASS
          volumeMounts:
            - name: rabbitmq-data
              mountPath: /var/lib/rabbitmq
            - name: config-volume
              mountPath: /etc/rabbitmq
          readinessProbe:
            exec:
              command:
                - rabbitmq-diagnostics
                - ping
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            exec:
              command:
                - rabbitmq-diagnostics
                - check_port_connectivity
            initialDelaySeconds: 60
            periodSeconds: 20
      volumes:
        - name: config-volume
          configMap:
            name: rabbitmq-config
  volumeClaimTemplates:
    - metadata:
        name: rabbitmq-data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        resources:
          requests:
            storage: 5Gi
        storageClassName: standard
`);
fs.writeFileSync(path.join(baseDir, 'rabbitmq', 'service.yaml'), `apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: travel-agency
spec:
  selector:
    app: rabbitmq
  ports:
    - name: amqp
      port: 5672
      targetPort: 5672
    - name: management
      port: 15672
      targetPort: 15672
`);
fs.writeFileSync(path.join(baseDir, 'pvc', 'rabbitmq-pvc.yaml'), `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: rabbitmq-data
  namespace: travel-agency
spec:
  accessModes: [ "ReadWriteOnce" ]
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
`);

// 5. For each service, generate resources
services.forEach(service => {
  const { name, port } = service;

  // ConfigMap
  fs.writeFileSync(path.join(baseDir, 'configmaps', `${name}-config.yaml`), `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}-config
  namespace: travel-agency
data:
  NODE_ENV: "production"
  PORT: "3000"
  SERVICE_NAME: "${name}"
  MONGODB_URL: "mongodb://${name}-mongodb.travel-agency.svc.cluster.local:27017"
  DATABASE_NAME: "${name}_db"
  RABBITMQ_URL: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq.travel-agency.svc.cluster.local:5672"
  # Additional service-specific env vars can be added here
`);

  // Secret (with placeholder values)
  let secretData = `apiVersion: v1
kind: Secret
metadata:
  name: ${name}-secrets
  namespace: travel-agency
type: Opaque
stringData:`;
  if (name === 'user-service') {
    secretData += `
  JWT_SECRET: "dev-jwt-secret-change-in-production"`;
  }
  if (name === 'email-service') {
    secretData += `
  SENDGRID_API_KEY: "your-sendgrid-api-key"
  FROM_EMAIL: "noreply@example.com"`;
  }
  // All services need a generic placeholder for other secrets
  secretData += `
  MONGODB_PASSWORD: "change-me"`
  fs.writeFileSync(path.join(baseDir, 'secrets', `${name}-secrets.yaml`), secretData + '\n');

  // Service (application)
  fs.writeFileSync(path.join(baseDir, 'services', `${name}-service.yaml`), `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: travel-agency
  labels:
    app: ${name}
spec:
  selector:
    app: ${name}
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
      name: http
`);
  // MongoDB Service (headless)
  fs.writeFileSync(path.join(baseDir, 'services', `${name}-mongodb-service.yaml`), `apiVersion: v1
kind: Service
metadata:
  name: ${name}-mongodb
  namespace: travel-agency
spec:
  selector:
    app: ${name}-mongodb
  ports:
    - port: 27017
      targetPort: 27017
  clusterIP: None
`);

  // Deployment (application)
  let deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: travel-agency
  labels:
    app: ${name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
    spec:
      containers:
        - name: ${name}
          image: travel-agency/${name}:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: ${name}-config
            - secretRef:
                name: ${name}-secrets
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
`;
  // Add service-specific environment variables
  if (name === 'order-service') {
    deployment += `          env:
            - name: PACKAGE_SERVICE_URL
              value: "http://package-service:3002"
`;
  } else if (name === 'customer-service') {
    deployment += `          env:
            - name: USER_SERVICE_URL
              value: "http://user-service:3001"
`;
  } else if (name === 'admin-service') {
    deployment += `          env:
            - name: USER_SERVICE_URL
              value: "http://user-service:3001"
            - name: ORDER_SERVICE_URL
              value: "http://order-service:3003"
            - name: PACKAGE_SERVICE_URL
              value: "http://package-service:3002"
`;
  }
  fs.writeFileSync(path.join(baseDir, 'deployments', `${name}-deployment.yaml`), deployment);

  // StatefulSet for MongoDB
  fs.writeFileSync(path.join(baseDir, 'statefulsets', `${name}-mongodb.yaml`), `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}-mongodb
  namespace: travel-agency
spec:
  serviceName: ${name}-mongodb
  replicas: 1
  selector:
    matchLabels:
      app: ${name}-mongodb
  template:
    metadata:
      labels:
        app: ${name}-mongodb
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
                  key: MONGODB_PASSWORD_${name.toUpperCase().replace(/-/g, '_')}
          command: ["mongod", "--bind_ip_all", "--auth"]
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
            timeoutSeconds: 2
            failureThreshold: 3
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        resources:
          requests:
            storage: 5Gi
        storageClassName: standard
`);

  // PVC for MongoDB (actually created by volumeClaimTemplate, but we can also create manually if not using template. With StatefulSet, PVCs are auto-created from template. So no need for separate PVC. But we could include a template if not using volumeClaimTemplate. I'll skip explicit PVC files.

});

// Gateway resources
fs.writeFileSync(path.join(baseDir, 'configmaps', 'gateway-config.yaml'), `apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-config
  namespace: travel-agency
data:
  NODE_ENV: "production"
  PORT: "3000"
  SERVICE_NAME: "gateway"
  RABBITMQ_URL: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq.travel-agency.svc.cluster.local:5672"
  USER_SERVICE_URL: "http://user-service:3001"
  PACKAGE_SERVICE_URL: "http://package-service:3002"
  ORDER_SERVICE_URL: "http://order-service:3003"
  CUSTOMER_SERVICE_URL: "http://customer-service:3004"
  MESSAGE_SERVICE_URL: "http://message-service:3005"
  EMAIL_SERVICE_URL: "http://email-service:3006"
  ADMIN_SERVICE_URL: "http://admin-service:3007"
`);
fs.writeFileSync(path.join(baseDir, 'secrets', 'gateway-secrets.yaml'), `apiVersion: v1
kind: Secret
metadata:
  name: gateway-secrets
  namespace: travel-agency
type: Opaque
stringData:
  JWT_SECRET: "dev-secret-change-in-production"
`);
fs.writeFileSync(path.join(baseDir, 'services', 'gateway.yaml'), `apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: travel-agency
spec:
  selector:
    app: gateway
  ports:
    - port: 3000
      targetPort: 3000
`);
fs.writeFileSync(path.join(baseDir, 'deployments', 'gateway-deployment.yaml'), `apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: travel-agency
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      containers:
        - name: gateway
          image: travel-agency/gateway:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: gateway-config
            - secretRef:
                name: gateway-secrets
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
`);

console.log('✓ Generated plain Kubernetes manifests in k8s/');
console.log('To deploy: kubectl apply -f k8s/namespace/ -f k8s/secrets/ -f k8s/configmaps/ -f k8s/services/ -f k8s/deployments/ -f k8s/statefulsets/ -f k8s/ingress/');