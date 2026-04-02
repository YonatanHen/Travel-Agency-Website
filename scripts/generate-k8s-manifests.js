const fs = require('fs');
const path = require('path');

const services = [
  { name: 'user-service', prefix: 'user', port: '3001' },
  { name: 'package-service', prefix: 'package', port: '3002' },
  { name: 'order-service', prefix: 'order', port: '3003' },
  { name: 'customer-service', prefix: 'customer', port: '3004' },
  { name: 'message-service', prefix: 'message', port: '3005' },
  { name: 'email-service', prefix: 'email', port: '3006' },
  { name: 'admin-service', prefix: 'admin', port: '3007' },
];

// Read template
const templatePath = path.join(__dirname, '..', 'k8s', 'services', 'template', 'kustomization.yaml.template');
const template = fs.readFileSync(templatePath, 'utf8');

services.forEach(service => {
  const dir = path.join(__dirname, '..', 'k8s', 'services', service.name);
  const patchesDir = path.join(dir, 'patches');

  // Create kustomization.yaml
  let content = template
    .replace(/{{SERVICE_NAME}}/g, service.name)
    .replace(/{{PREFIX}}/g, service.prefix);

  fs.writeFileSync(path.join(dir, 'kustomization.yaml'), content);

  // Create deployment patch
  const deploymentPatch = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service.prefix}
spec:
  template:
    spec:
      containers:
        - name: ${service.prefix}
          image: travel-agency/${service.name}:latest
          env:
            - name: PORT
              value: "3000"
`;
  fs.writeFileSync(path.join(patchesDir, `${service.name}-deployment-patch.yaml`), deploymentPatch);

  // Create service patch
  const servicePatch = `apiVersion: v1
kind: Service
metadata:
  name: ${service.prefix}
spec:
  selector:
    app: ${service.prefix}
  ports:
    - port: 3000
      targetPort: 3000
`;
  fs.writeFileSync(path.join(patchesDir, `${service.name}-service-patch.yaml`), servicePatch);

  console.log(`✓ Generated ${service.name}`);
});

console.log('\n✓ All service manifests generated');