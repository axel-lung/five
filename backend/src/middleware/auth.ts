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

/**
 * Verifie un access token et renvoie son porteur, ou null.
 *
 * Extrait du middleware pour que le WebSocket (src/ws) authentifie ses
 * connexions avec exactement la meme regle — notamment le refus d'un refresh
 * token la ou un access token est attendu. Une seconde copie de cette
 * verification finirait par diverger de celle-ci.
 */
export const verifyAccessToken = (token: string): { id: string; email: string } | null => {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (payload.type !== 'access') return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
};

// JWT authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const user = verifyAccessToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  (req as any).user = user;
  next();
};
