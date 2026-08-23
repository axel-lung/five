import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type TokenType = 'access' | 'refresh';

export interface AccessTokenPayload {
  id: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
}

/**
 * Un access token ne doit jamais etre accepte la ou un refresh token est
 * attendu, et inversement : sans la revendication `type`, un refresh token
 * (valable 30 jours) ferait office de token d'acces permanent.
 */
export const generateAccessToken = (user: { id: string; email: string }) =>
  jwt.sign({ id: user.id, email: user.email, type: 'access' }, env.jwtSecret, {
    expiresIn: env.accessTokenTtl,
  } as jwt.SignOptions);

export const generateRefreshToken = (user: { id: string }) =>
  jwt.sign({ id: user.id, type: 'refresh' }, env.jwtSecret, {
    expiresIn: env.refreshTokenTtl,
  } as jwt.SignOptions);

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return payload as RefreshTokenPayload;
};

// JWT authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;

    if (payload.type !== 'access') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    (req as any).user = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
