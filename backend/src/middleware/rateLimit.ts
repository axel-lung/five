import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * S-05 : limites de debit.
 *
 * Neutralise dans deux cas, jamais en production :
 *
 * - en test, ou la suite cree des dizaines de comptes en boucle
 *   (test/helpers.ts) et deviendrait rouge par intermittence ;
 * - sur demande explicite via DISABLE_RATE_LIMIT, pour les parcours
 *   navigateur, qui creent eux aussi de nombreux comptes contre un serveur
 *   de developpement.
 *
 * La garde sur `nodeEnv` est volontairement redondante : une variable
 * d'environnement mal placee ne doit pas pouvoir desarmer la protection
 * anti-brute-force d'un serveur de production.
 */
const disabled =
  env.nodeEnv === 'test' ||
  (env.nodeEnv !== 'production' && process.env.DISABLE_RATE_LIMIT === '1');

const limiter = (windowMs: number, max: number, message: string) => {
  if (disabled) {
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
