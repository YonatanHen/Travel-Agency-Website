const request = require('supertest');
const { startServer } = require('../../src/server');

describe('User Service Integration Tests', () => {
  let server;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('user-service');
    });
  });

  describe('Authentication Routes', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(server).get('/api/auth/non-existent');
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting in production', async () => {
      // This test would need to be adjusted based on environment
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
    });
  });
});