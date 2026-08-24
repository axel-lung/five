import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

/** Types acceptes pour une image, et leur extension canonique. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * C-02 / G-01 : reception d'une image.
 *
 * En memoire et non sur disque : le fichier repart aussitot vers le stockage
 * objet, et un fichier temporaire serait une surface d'attaque de plus.
 *
 * Le type est valide sur le mimetype declare ET fige par notre propre
 * extension : le nom d'origine n'est jamais repris, il est fourni par le
 * client et pourrait contenir un chemin ou une extension trompeuse.
 */
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_TYPES[file.mimetype]) {
      cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Enveloppe multer pour traduire ses erreurs en 400.
 *
 * Sans cela, un fichier trop lourd ou d'un type refuse remonterait au
 * gestionnaire d'erreurs global et sortirait en 500, alors que la faute est
 * cote client.
 */
export const uploadImage = (field: string) => {
  const handler = uploader.single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: any) => {
      if (!error) {
        return next();
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image too large (2 MB max)' });
      }

      if (error.message === 'UNSUPPORTED_IMAGE_TYPE') {
        return res.status(400).json({ message: 'Unsupported image type (jpeg, png, webp)' });
      }

      return res.status(400).json({ message: 'Invalid upload' });
    });
  };
};
