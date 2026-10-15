const { communitySchema, paginationSchema, registerSchema } = require('@campusconnect/types');
const { AppError, UnauthorizedError } = require('../dist/lib/errors');
const { verifyAccessToken, signAccessToken } = require('../dist/lib/jwt');

describe('shared input contracts', () => {
  test('normalizes registration email and rejects short passwords', () => {
    const result = registerSchema.safeParse({
      body: { email: 'STUDENT@example.edu', password: 'tiny', displayName: 'Student' },
    });
    expect(result.success).toBe(false);
    expect(registerSchema.parse({
      body: { email: 'STUDENT@example.edu', password: 'long-enough-password', displayName: 'Student' },
    }).body.email).toBe('student@example.edu');
  });

  test('requires valid page bounds', () => {
    expect(paginationSchema.parse({ page: '2', limit: '30' })).toEqual({ page: 2, limit: 30 });
    expect(paginationSchema.safeParse({ page: '0', limit: '1000' }).success).toBe(false);
  });

  test('rejects unexpected create fields', () => {
    expect(communitySchema.safeParse({ body: {
      name: 'A test community',
      description: 'A sufficiently long description for this community.',
      category: 'Testing',
      ownerId: 'attacker-controlled',
    } }).success).toBe(false);
  });
});

describe('JWT handling', () => {
  test('verifies a valid access token payload', () => {
    const token = signAccessToken({ userId: 'user-id', role: 'STUDENT' });
    expect(verifyAccessToken(token)).toEqual({ userId: 'user-id', role: 'STUDENT' });
  });

  test('maps malformed and tampered tokens to a typed unauthorized error', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(UnauthorizedError);
    try {
      verifyAccessToken('not-a-jwt');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
    }
  });
});
