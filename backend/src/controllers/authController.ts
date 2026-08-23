import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';

// Register a new user
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, city } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await UserModel.create({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      city,
      emailVerified: false,
    });

    // Generate JWT tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
    });
    const refreshTokenValue = generateRefreshToken({ id: user.id });

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
      refreshToken: refreshTokenValue,
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
    const user = await UserModel.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
    });
    const refreshTokenValue = generateRefreshToken({ id: user.id });

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
      refreshToken: refreshTokenValue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Echange un refresh token contre un nouvel access token.
 *
 * La route est publique par construction : l'appelant a justement un access
 * token expire. C'est le refresh token du corps de requete qui authentifie.
 *
 * Limite assumee en V1 : les refresh tokens ne sont pas stockes, donc pas
 * revocables avant leur expiration. Une table dediee sera necessaire des que
 * la deconnexion devra invalider une session a distance.
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body?.refreshToken;

    if (!token) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Le compte a pu etre supprime depuis l'emission du token.
    const user = await UserModel.findByPk(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    res.json({
      accessToken: generateAccessToken({ id: user.id, email: user.email }),
      refreshToken: generateRefreshToken({ id: user.id }),
    });
  } catch (error) {
    next(error);
  }
};

// Logout user (client-side should remove token)
export const logoutUser = (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
};