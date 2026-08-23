import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err: any, user: any) => {
    if (err) {
      return res.sendStatus(403); // Forbidden
    }
    req.user = user;
    next();
  });
};

// Optional: Generate JWT token
export const generateAccessToken = (user: any) => {
  return jwt.sign(user, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
};