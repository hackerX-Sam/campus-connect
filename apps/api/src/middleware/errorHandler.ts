import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Operational application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Prisma constraint violations
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({
      success: false,
      error: 'A record with this value already exists',
    });
    return;
  }
  if ((err as { code?: string }).code === 'P2025') {
    res.status(404).json({ success: false, error: 'Resource not found' });
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ success: false, error: 'Request body is too large' });
    return;
  }
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: 'Malformed JSON request body' });
    return;
  }

  // Unknown errors — log full details but never expose internals
  logger.error('Unhandled request error', { method: req.method, path: req.path, error: err });
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
  });
}
