const serverUrl = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? '3001'}`;

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'CampusConnect API',
    version: '1.0.0',
    description: 'Campus communities, events, projects, and discussions API.',
  },
  servers: [{ url: serverUrl }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      Page: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          total: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'API is healthy' } },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'displayName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                  displayName: { type: 'string', minLength: 2, maxLength: 60 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Account created' }, '400': { description: 'Invalid input' } },
      },
    },
    '/api/auth/login': {
      post: { summary: 'Sign in', responses: { '200': { description: 'Signed in' }, '401': { description: 'Invalid credentials' } } },
    },
    '/api/communities': {
      get: {
        summary: 'Search public communities',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: { '200': { description: 'Community page' } },
      },
      post: { summary: 'Create a community', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
    '/api/events': {
      get: { summary: 'List published events', responses: { '200': { description: 'Event page' } } },
      post: { summary: 'Create an event', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
    '/api/projects': {
      get: { summary: 'List projects', responses: { '200': { description: 'Project page' } } },
      post: { summary: 'Create a project', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } },
    },
  },
};
