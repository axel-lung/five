import { Request, Response, NextFunction } from 'express';
import {
  UserModel as User,
  GroupModel as Group,
  GroupMemberModel as GroupMember,
} from '../models';
import { storage } from '../services/storage';
import { IMAGE_TYPES } from '../middleware/upload';

/** Chemin public d'un media, servi par l'API elle-meme. */
const mediaUrl = (key: string) => `/api/media/${key}`;

/** C-02 : televerser son avatar. */
export const uploadUserAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const key = await storage.save(file.buffer, file.mimetype, IMAGE_TYPES[file.mimetype]);
    const url = mediaUrl(key);

    await User.update({ avatarUrl: url } as any, { where: { id: userId } });

    res.status(201).json({ avatarUrl: url });
  } catch (error) {
    next(error);
  }
};

/** G-01 : televerser l'avatar d'un groupe. Owner et admin seulement. */
export const uploadGroupAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const groupId = req.params.id;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const membership = await GroupMember.findOne({ where: { groupId, userId } });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }

    const key = await storage.save(file.buffer, file.mimetype, IMAGE_TYPES[file.mimetype]);
    const url = mediaUrl(key);

    await group.update({ avatarUrl: url } as any);

    res.status(201).json({ avatarUrl: url });
  } catch (error) {
    next(error);
  }
};

/**
 * Ressert un media depuis le stockage objet.
 *
 * Route publique : un avatar s'affiche dans une balise <img>, qui ne porte
 * pas d'en-tete d'authentification. La cle est un UUID aleatoire, donc non
 * enumerable — meme posture que le lien partageable d'un evenement (E-07).
 */
export const getMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // La cle est generee par nous et ne contient qu'un UUID et une extension.
    // On le verifie tout de meme : elle arrive ici depuis l'exterieur, et un
    // '../' ne doit jamais atteindre la couche de stockage.
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(req.params.key)) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const object = await storage.get(req.params.key);
    if (!object) {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.setHeader('Content-Type', object.contentType);
    // Le contenu d'une cle ne change jamais : une nouvelle image donne une
    // nouvelle cle. Le cache peut donc etre agressif.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(object.body);
  } catch (error) {
    next(error);
  }
};
