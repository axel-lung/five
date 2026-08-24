import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { mailer } from '../services/mailer';
import { env } from '../config/env';
import crypto from 'crypto';

// Register a new user
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, city, acceptMarketing } = req.body;

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
      // C-01 : chaque consentement est horodate separement. Le schema impose
      // deja acceptTos a true, le marketing reste optionnel.
      consentTosAt: new Date(),
      consentMarketingAt: acceptMarketing ? new Date() : null,
    } as any);

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
    // Meme reponse qu'un mot de passe errone pour un compte efface : ne rien
    // laisser deduire de l'existence passee d'un compte (C-06).
    if (!user || user.deletedAt) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // B-02 : un compte suspendu garde son mot de passe valide, mais la
    // suspension doit lui etre annoncee — contrairement a l'effacement, elle
    // est reversible et il doit savoir a qui s'adresser.
    if (user.suspendedAt) {
      return res.status(403).json({
        message: 'Account suspended',
        reason: user.suspensionReason,
      });
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

    // Le compte a pu etre efface depuis l'emission du token. Les access
    // tokens deja emis restent valides jusqu'a expiration (1 h par defaut) :
    // authenticateToken ne touche pas la base, par choix de performance.
    const user = await UserModel.findByPk(payload.id);
    if (!user || user.deletedAt || user.suspendedAt) {
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
/** Delai minimal entre deux demandes de verification, garde anti-spam (C-05). */
const VERIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * C-05 : demander un lien de verification d'email.
 *
 * Le transport reel n'est pas branche en V1 : `mailer` ecrit dans les logs et
 * Resend s'y substituera sans toucher a ce controleur. Hors production, le
 * token est renvoye dans la reponse pour permettre un test bout en bout — il
 * ne doit JAMAIS l'etre en production, ou il ferait de la verification une
 * formalite pour n'importe quel appelant.
 */
export const requestEmailVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const user = await UserModel.findByPk(userId);
    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const sentAt = user.emailVerificationSentAt;
    if (sentAt && Date.now() - new Date(sentAt).getTime() < VERIFICATION_COOLDOWN_MS) {
      return res.status(429).json({ message: 'A verification email was just sent' });
    }

    const token = crypto.randomUUID();
    await user.update({
      emailVerificationToken: token,
      emailVerificationSentAt: new Date(),
    } as any);

    await mailer.send({
      to: user.email,
      subject: 'Verifiez votre adresse email',
      body: `Votre code de verification : ${token}`,
    });

    res.json({
      message: 'Verification email sent',
      ...(env.nodeEnv === 'production' ? {} : { token }),
    });
  } catch (error) {
    next(error);
  }
};

/** C-05 : valider le lien recu. Route publique : le token fait foi. */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findOne({
      where: { emailVerificationToken: req.params.token },
    });

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'Invalid or expired verification token' });
    }

    // Le token est consomme : un lien ne vaut que pour une verification.
    await user.update({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationSentAt: null,
    } as any);

    res.json({ message: 'Email verified' });
  } catch (error) {
    next(error);
  }
};
