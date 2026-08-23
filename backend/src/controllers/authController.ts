import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../middleware/auth';

// Register a new user
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, city } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      city,
      emailVerified: false, // In a real app, you'd send verification email
    });

    // Generate JWT token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
    });

    // Return user info (without password) and token
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        city: user.city,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
    });

    // Return user info (without password) and token
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        city: user.city,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token (simplified - in production you'd use refresh tokens)
export const refreshToken = (req: Request, res: Response) => {
  // For simplicity, we're just generating a new access token
  // In a production app, you'd implement proper refresh token rotation
  const { user } = req;
  if (!user) {
    return res.sendStatus(401);
  }

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
  });

  res.json({ accessToken });
};

// Logout user (client-side should remove token)
export const logoutUser = (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
};