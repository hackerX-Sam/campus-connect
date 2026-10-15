import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { UnauthorizedError } from './errors';

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

function secret(value: string | undefined, name: string): string {
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set to at least 32 characters in production`);
  }
  return value || `local-only-${name.toLowerCase()}-secret-not-for-production`;
}

const accessSecret = secret(ACCESS_SECRET, 'JWT_SECRET');
const refreshSecret = secret(REFRESH_SECRET, 'JWT_REFRESH_SECRET');

export interface JwtPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, accessSecret, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, refreshSecret, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

function verifyToken(token: string, signingSecret: string): JwtPayload {
  try {
    const payload = jwt.verify(token, signingSecret);
    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string' ||
      !['STUDENT', 'ADMIN'].includes(String(payload.role))
    ) {
      throw new UnauthorizedError('Invalid authentication token');
    }
    return { userId: payload.userId, role: String(payload.role) };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
}

export const verifyAccessToken = (token: string): JwtPayload => verifyToken(token, accessSecret);
export const verifyRefreshToken = (token: string): JwtPayload => verifyToken(token, refreshSecret);

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
