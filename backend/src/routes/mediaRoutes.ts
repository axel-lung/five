import { Router } from 'express';
import { getMedia } from '../controllers/mediaController';

const router = Router();

// Publique : un avatar s'affiche dans une <img>, qui ne porte pas d'en-tete
// d'authentification. Voir le commentaire de getMedia.
router.get('/:key', getMedia);

export default router;
