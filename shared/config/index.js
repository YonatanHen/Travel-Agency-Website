require('dotenv').config();

class Config {
  static get(serviceName) {
    return {
      port: parseInt(process.env.PORT) || 3000,
      serviceName: process.env.SERVICE_NAME || serviceName,
      nodeEnv: process.env.NODE_ENV || 'development',
      mongodb: {
        url: process.env.MONGODB_URL,
        database: process.env.DATABASE_NAME
      },
      jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
      },
      rabbitmq: {
        url: process.env.RABBITMQ_URL
      },
      email: {
        sendgridKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      },
      services: {
        user: process.env.USER_SERVICE_URL || 'http://user-service:3001',
        package: process.env.PACKAGE_SERVICE_URL || 'http://package-service:3002',
        order: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
        customer: process.env.CUSTOMER_SERVICE_URL || 'http://customer-service:3004',
        message: process.env.MESSAGE_SERVICE_URL || 'http://message-service:3005',
        email: process.env.EMAIL_SERVICE_URL || 'http://email-service:3006',
        admin: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3007'
      }
    };
  }
}

module.exports = Config;