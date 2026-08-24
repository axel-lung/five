import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * S-05 : limites de debit.
 *
 * Neutralise en test : la suite cree des dizaines de comptes en boucle
 * (test/helpers.ts) et deviendrait rouge par intermittence.
 */
const limiter = (windowMs: number, max: number, message: string) => {
  if (env.nodeEnv === 'test') {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });
};

/**
 * Sur l'authentification : sans cette limite, /api/auth/login accepte un
 * nombre illimite de tentatives, donc un brute-force du mot de passe.
 */
export const authLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Too many attempts, try again later'
);

/**
 * Sur la creation de contenu : un lien d'invitation ou un evenement se cree
 * en une requete, et rien n'empeche aujourd'hui d'en generer des milliers.
 */
export const createLimiter = limiter(
  60 * 60 * 1000,
  30,
  'Too many creations, try again later'
);
