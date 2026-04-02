const fs = require('fs');
const path = require('path');

const services = ['user-service', 'package-service', 'order-service', 'customer-service', 'message-service', 'email-service', 'admin-service'];
const others = ['gateway', 'frontend'];

let created = 0;
[...services, ...others].forEach(dir => {
  const examplePath = path.join(__dirname, '..', dir, '.env.example');
  const envPath = path.join(__dirname, '..', dir, '.env');

  if (fs.existsSync(examplePath) && !fs.existsSync(envPath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log(`✓ Created ${dir}/.env`);
    created++;
  } else if (fs.existsSync(envPath)) {
    console.log(`- Skipped ${dir}/.env (already exists)`);
  }
});

console.log(`\nCreated ${created} .env files.`);
console.log('NOTE: These are templates. Edit them with real values before running services.');
console.log('For K8s deployment, secrets are managed via kubectl, not .env files.');