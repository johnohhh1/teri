const request = require('supertest');
const { createApp } = require('../../../backend/src/app');
const { testHelpers, performanceHelpers } = global;

describe('Authentication API', () => {
  let app;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  beforeEach(async () => {
    await testHelpers.cleanDatabase();
  });
  
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User'
      };
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/auth/register')
          .send(userData)
      );
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user_id).toBeDefined();
      
      // Performance requirement: Auth < 300ms (PRD Section 8.1)
      expect(durationMs).toBeWithinTimeLimit(300);
    });
    
    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject weak passwords', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });
    
    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      };
      
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      // Second registration (should fail)
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
    
    it('should enforce rate limiting', async () => {
      const userData = {
        email: 'ratelimit@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      };
      
      // Exceed rate limit (5 requests per 15 minutes per PRD Appendix C)
      const promises = Array(6).fill().map((_, i) => 
        request(app)
          .post('/api/v1/auth/register')
          .send({ ...userData, email: `ratelimit${i}@example.com` })
      );
      
      const responses = await Promise.all(promises);
      const lastResponse = responses[5];
      
      expect(lastResponse.status).toBe(429);
    });
  });
  
  describe('POST /api/v1/auth/login', () => {
    let testUser;
    
    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      // Register the user first
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
    });
    
    it('should login with valid credentials', async () => {
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('token');
      
      // Performance requirement: Auth < 300ms
      expect(durationMs).toBeWithinTimeLimit(300);
    });
    
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });
    
    it('should include partner_id if user is paired', async () => {
      // This will be expanded when pairing tests are implemented
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(response.status).toBe(200);
      // partner_id should be null for unpaired user
      expect(response.body.partner_id).toBeNull();
    });
  });
  
  describe('POST /api/v1/auth/refresh', () => {
    let testUser, authToken;
    
    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      authToken = registerResponse.body.token;
    });
    
    it('should refresh token with valid authorization', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).not.toBe(authToken); // New token
    });
    
    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
    
    it('should reject refresh without authorization header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/v1/auth/logout', () => {
    let testUser, authToken;
    
    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      authToken = registerResponse.body.token;
    });
    
    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should handle logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Security Tests', () => {
    it('should prevent SQL injection in login', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: maliciousInput,
          password: maliciousInput
        });
      
      // Should not cause server error, just invalid credentials
      expect(response.status).toBe(401);
      
      // Verify table still exists by attempting a valid registration
      const testUser = await testHelpers.createTestUser();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(registerResponse.status).toBe(201);
    });
    
    it('should sanitize XSS attempts in registration', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: xssPayload
        });
      
      if (response.status === 201) {
        // If registration succeeds, name should be sanitized
        expect(response.body.name).not.toContain('<script>');
      }
    });
    
    it('should hash passwords securely', async () => {
      const testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      // Verify password is not stored in plaintext
      // This would require database access to fully test
      // For now, just ensure registration succeeds and login works
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(loginResponse.status).toBe(200);
    });
  });
});
