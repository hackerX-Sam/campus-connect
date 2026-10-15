const request = require('supertest');
const app = require('../dist/app').default;

describe('security hardening', () => {
  test('adds baseline browser security headers', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  test('rejects protected API requests without credentials', async () => {
    const response = await request(app).get('/api/admin/stats');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: 'Authentication required' });
  });

  test('rejects malformed JSON with a client error', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('serves the OpenAPI document and Swagger UI', async () => {
    const spec = await request(app).get('/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.3');
    expect(spec.body.paths['/api/communities']).toBeDefined();
    const docs = await request(app).get('/docs/');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('swagger-ui');
  });

  test('does not grant CORS access to arbitrary origins', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://attacker.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
