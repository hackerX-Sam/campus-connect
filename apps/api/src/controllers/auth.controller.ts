import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashRefreshToken } from '../lib/jwt';
import { validate, registerSchema, loginSchema } from '../lib/validation';
import { ConflictError, UnauthorizedError } from '../lib/errors';
import { AuthRequest } from '../middleware/authenticate';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(registerSchema, { body: req.body });

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        profile: {
          create: {
            displayName: body.displayName,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: { select: { displayName: true } },
      },
    });

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    // Store refresh token session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(refreshToken),
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res
      .cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      .cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .status(201)
      .json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, role: user.role, profile: user.profile },
          accessToken,
        },
      });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(loginSchema, { body: req.body });

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        profile: { select: { displayName: true, avatarUrl: true } },
      },
    });

    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedError('Your account has been deactivated');

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(refreshToken),
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res
      .cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      .cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.profile,
          },
          accessToken,
        },
      });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { token: hashRefreshToken(refreshToken) } });
    }

    res
      .clearCookie('access_token')
      .clearCookie('refresh_token')
      .json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new UnauthorizedError('Refresh token missing');

    const payload = verifyRefreshToken(token);

    const tokenHash = hashRefreshToken(token);
    const session = await prisma.session.findUnique({ where: { token: tokenHash } });
    if (!session || session.userId !== payload.userId || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Session expired, please login again');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedError('Account not found');

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { token: tokenHash } });
      await tx.session.create({
        data: {
          userId: user.id,
          token: hashRefreshToken(refreshToken),
          expiresAt,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    });

    res
      .cookie('access_token', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      })
      .cookie('refresh_token', refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        profile: true,
      },
    });

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}
