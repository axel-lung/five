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

const limiter = (
  windowMs: number,
  max: number,
  message: string,
  keyGenerator?: (req: Request) => string
) => {
  if (disabled) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
    ...(keyGenerator
      ? {
          keyGenerator,
          // La cle n'est plus une IP : la validation IPv6 d'express-rate-limit
          // n'a plus lieu d'etre et se contenterait d'avertir au demarrage.
          validate: { keyGeneratorIpFallback: false },
        }
      : {}),
  });
};

/** Identifie par compte plutot que par IP — voir chatLimiter. */
const byUser = (req: Request) => (req as any).user?.id ?? req.ip ?? 'anonymous';

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

/**
 * Sur le chat : les 30 par heure de createLimiter y seraient inutilisables.
 * Un humain envoie au plus une dizaine de messages courts par minute, meme en
 * pleine dispute d'avant-match ; 30 laisse de la marge et arrete un script.
 *
 * Clef sur le compte et non sur l'IP : les membres d'un meme groupe sont
 * souvent derriere le meme wifi — au vestiaire, justement — et se
 * partageraient sinon le quota. Ces routes sont toutes derriere
 * authenticateToken, `req.user.id` est donc toujours present.
 */
export const chatLimiter = limiter(
  60 * 1000,
  30,
  'Too many messages, slow down',
  byUser
);

/** Chaque image coute jusqu'a 2 Mo de stockage objet, d'ou un plafond a part. */
export const chatImageLimiter = limiter(
  60 * 60 * 1000,
  60,
  'Too many images, try again later',
  byUser
);
