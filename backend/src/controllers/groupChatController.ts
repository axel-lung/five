import { Request, Response, NextFunction } from 'express';
import { Op, QueryTypes, UniqueConstraintError } from 'sequelize';
import {
  GroupModel as Group,
  GroupMessageModel as GroupMessage,
  UserModel as User,
  UserBlockModel as UserBlock,
  sequelize,
} from '../models';
import { PUBLIC_USER_ATTRIBUTES } from '../utils/publicAttributes';
import { requireGroupMember } from '../utils/groupAccess';
import { listGroupMessagesSchema } from '../utils/validationSchemas';
import { storage } from '../services/storage';
import { IMAGE_TYPES } from '../middleware/upload';
import { publishMessage, publishDeletion } from '../ws';

/**
 * S-01 : chat de groupe.
 *
 * REST est la source de verite ; le WebSocket (src/ws) ne fait que pousser ce
 * qui a deja ete ecrit ici. C'est ce decoupage qui rend le temps reel
 * correct : une socket n'est pas une file durable, et un client qui a manque
 * des trames se rattrape par `GET ?since=`.
 */

/**
 * Plafond du mode `since`. Au-dela, on prefere dire au client de tout
 * recharger plutot que de lui laisser recoudre un trou dans sa liste.
 */
const SINCE_CAP = 200;

const authorInclude = {
  model: User,
  as: 'author',
  // Jamais de selection a la main : publicAttributes documente une fuite
  // passee d'email et de telephone. Un auteur anonymise ressort avec
  // firstName a null, que les clients affichent « Compte supprime ».
  attributes: PUBLIC_USER_ATTRIBUTES,
};

/**
 * Forme d'un message sur le fil, partagee par REST et par le WebSocket.
 *
 * Une seule fonction pour les deux chemins : deux serialisations finiraient
 * par diverger, et le client fusionne des messages venus des deux.
 */
export const serializeMessage = (message: any) => ({
  id: message.id,
  groupId: message.groupId,
  authorId: message.authorId,
  body: message.body ?? null,
  imageUrl: message.imageUrl ?? null,
  createdAt: message.createdAt,
  deletedAt: message.deletedAt ?? null,
  deletedBy: message.deletedBy ?? null,
  author: message.author
    ? {
        id: message.author.id,
        firstName: message.author.firstName,
        lastName: message.author.lastName,
        avatarUrl: message.author.avatarUrl,
      }
    : null,
});

/**
 * Garde d'acces au chat, commune a toutes les routes ci-dessous.
 *
 * Le chat est reserve aux membres **meme en groupe public** : c'est la
 * conversation des membres, pas un panneau d'affichage.
 *
 * Le code de refus differe selon la nature du groupe. Pour un groupe prive on
 * repond 404, comme partout ailleurs : son existence meme ne regarde pas les
 * non-membres. Pour un groupe public, 403 — `getGroups` expose deja tous les
 * groupes publics a tout le monde, il n'y a donc rien a cacher, et le client
 * peut proposer « Rejoignez le groupe » au lieu du trompeur « Groupe
 * introuvable ».
 *
 * Renvoie null apres avoir repondu ; l'appelant n'a qu'a s'arreter.
 */
const openChat = async (req: Request, res: Response) => {
  const groupId = req.params.id;
  const userId = (req as any).user.id;

  const group = await Group.findByPk(groupId);
  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return null;
  }

  const membership = await requireGroupMember(group.id, userId);
  if (!membership) {
    if ((group as any).accessType === 'public') {
      res.status(403).json({ message: 'Join this group to read its chat' });
    } else {
      res.status(404).json({ message: 'Group not found' });
    }
    return null;
  }

  return { group, membership, userId };
};

/**
 * D-06 : identifiants des comptes avec qui l'utilisateur est en situation de
 * blocage, dans un sens ou dans l'autre.
 *
 * Charges une fois par requete plutot qu'appel a `isBlockedBetween` par
 * message : le fil en compte des dizaines.
 */
export const blockedCounterparts = async (userId: string): Promise<string[]> => {
  const blocks = await UserBlock.findAll({
    where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
    attributes: ['blockerId', 'blockedId'],
  });

  return blocks.map((block: any) =>
    block.blockerId === userId ? block.blockedId : block.blockerId
  );
};

/** GET /api/groups/:id/messages */
export const listMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await openChat(req, res);
    if (!chat) return;

    const { error, value } = listGroupMessagesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message),
      });
    }

    const { before, beforeId, since, limit } = value as {
      before?: Date;
      beforeId?: string;
      since?: Date;
      limit: number;
    };

    const blocked = await blockedCounterparts(chat.userId);
    const scope: any = { groupId: chat.group.id };
    if (blocked.length > 0) {
      // Le blocage filtre en LECTURE et non a l'envoi. Il est deux-a-deux,
      // alors qu'un chat de groupe a N lecteurs : refuser le message de A
      // parce que B l'a bloque laisserait n'importe quel membre baillonner
      // n'importe quel autre pour tout le groupe.
      scope.authorId = { [Op.notIn]: blocked };
    }

    // Rattrapage apres reconnexion : ce qui est apparu depuis, et ce qui a
    // ete supprime depuis. La seconde branche est indispensable — un delta
    // sait signaler l'apparition d'une ligne, jamais une absence, et c'est
    // pour cela que la suppression laisse une pierre tombale.
    if (since) {
      const rows = await GroupMessage.findAll({
        where: {
          ...scope,
          [Op.or]: [{ createdAt: { [Op.gt]: since } }, { deletedAt: { [Op.gt]: since } }],
        },
        include: [authorInclude],
        order: [
          ['createdAt', 'ASC'],
          ['id', 'ASC'],
        ],
        limit: SINCE_CAP + 1,
      });

      const truncated = rows.length > SINCE_CAP;
      return res.json({
        messages: rows.slice(0, SINCE_CAP).map(serializeMessage),
        // Le client jette sa liste et recharge la page la plus recente : mieux
        // vaut un rechargement qu'une liste trouee dont il ne saura rien.
        truncated,
      });
    }

    // Pagination vers le passe, par curseur keyset et non par OFFSET : un chat
    // prend des insertions en tete pendant qu'on remonte l'historique, et un
    // OFFSET sauterait ou repeterait une ligne a chaque nouveau message.
    //
    // Forme Op.or plutot que comparaison de tuple SQL : Sequelize prefixe les
    // colonnes de l'alias du modele, qu'un literal devrait deviner. Postgres
    // sait de toute facon utiliser l'index (group_id, created_at, id).
    const cursor =
      before && beforeId
        ? {
            [Op.or]: [
              { createdAt: { [Op.lt]: before } },
              { createdAt: before, id: { [Op.lt]: beforeId } },
            ],
          }
        : {};

    // Un de plus que demande : c'est ce qui dit s'il reste quelque chose,
    // sans payer un COUNT sur tout l'historique.
    const rows = await GroupMessage.findAll({
      where: { ...scope, ...cursor },
      include: [authorInclude],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last: any = page[page.length - 1];

    res.json({
      messages: page.map(serializeMessage),
      hasMore,
      nextCursor: hasMore && last ? { before: last.createdAt, beforeId: last.id } : null,
    });
  } catch (error) {
    next(error);
  }
};

/** Recharge un message avec son auteur, pour le serialiser. */
const withAuthor = (id: string) =>
  GroupMessage.findByPk(id, { include: [authorInclude] });

/** POST /api/groups/:id/messages */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await openChat(req, res);
    if (!chat) return;

    const { body, clientNonce } = req.body as { body: string; clientNonce?: string };

    // Renvoi idempotent : le client rejoue le meme nonce apres une coupure
    // reseau. Sans ce rattrapage, le message serait duplique.
    if (clientNonce) {
      const existing = await GroupMessage.findOne({
        where: { authorId: chat.userId, clientNonce },
        include: [authorInclude],
      });
      if (existing) {
        return res.status(200).json(serializeMessage(existing));
      }
    }

    let created: any;
    try {
      created = await GroupMessage.create({
        groupId: chat.group.id,
        authorId: chat.userId,
        body: body.trim(),
        clientNonce: clientNonce ?? null,
      });
    } catch (err) {
      // Deux envois concurrents portant le meme nonce : la verification
      // ci-dessus les a laisses passer tous les deux, l'index unique partiel
      // en arrete un. C'est lui qui garantit l'unicite, pas la lecture.
      if (err instanceof UniqueConstraintError && clientNonce) {
        const existing = await GroupMessage.findOne({
          where: { authorId: chat.userId, clientNonce },
          include: [authorInclude],
        });
        if (existing) return res.status(200).json(serializeMessage(existing));
      }
      throw err;
    }

    const message = await withAuthor(created.id);
    const payload = serializeMessage(message);

    // Pousse apres l'ecriture, jamais avant : la socket ne doit annoncer que
    // ce qui est deja en base. Sans effet si personne n'ecoute.
    publishMessage(chat.group.id, payload);

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:id/messages/:messageId
 *
 * L'auteur supprime son message ; owner et admin peuvent supprimer celui d'un
 * autre, au titre de la moderation.
 */
export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await openChat(req, res);
    if (!chat) return;

    // Recherche portee par le groupe du chemin, et jamais par findByPk seul :
    // sinon /groups/<le mien>/messages/<message d-un autre groupe> revelerait
    // l'existence de ce message.
    const message: any = await GroupMessage.findOne({
      where: { id: req.params.messageId, groupId: chat.group.id },
      include: [authorInclude],
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Idempotent : un client qui rejoue apres une trame perdue ne doit pas
    // recevoir d'erreur pour une suppression deja faite.
    if (message.deletedAt) {
      return res.status(200).json(serializeMessage(message));
    }

    const role = (chat.membership as any).role;
    const isAuthor = message.authorId === chat.userId;
    const canModerate = role === 'owner' || role === 'admin';

    if (!isAuthor && !canModerate) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // L'objet de stockage part avec la ligne. GET /api/media/:key est public :
    // se contenter de retirer la reference laisserait l'image accessible pour
    // toujours a qui en a vu l'URL.
    const storedKey = message.imageUrl
      ? String(message.imageUrl).replace('/api/media/', '')
      : null;

    // Le contenu est efface, pas seulement masque : une pierre tombale qui
    // garde le texte n'est pas une suppression, et un export RGPD le
    // contiendrait encore.
    await message.update({
      deletedAt: new Date(),
      deletedBy: chat.userId,
      body: null,
      imageUrl: null,
    });

    if (storedKey) {
      await storage.delete(storedKey);
    }

    const payload = serializeMessage(message);
    publishDeletion(chat.group.id, payload);

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * Nombre de messages non lus, par groupe, pour un utilisateur.
 *
 * En une seule requete groupee et non un appel par groupe : l'ecran liste des
 * groupes l'appelle a chaque affichage.
 *
 * Ecrite en SQL brut : le COALESCE porte sur deux tables jointes, ce que le
 * DSL de Sequelize exprime tres mal. Precedent de sequelize.literal dans
 * accountController.
 *
 * Trois conditions, chacune indispensable :
 *  - COALESCE(..., gm.joined_at) : un nouveau membre n'herite pas en non-lus
 *    de tout l'arriere d'un groupe bavard ;
 *  - author_id <> :userId : ses propres messages ne sont jamais non lus ;
 *  - deleted_at IS NULL : un message supprime n'entretient pas la pastille.
 */
export const unreadCountsFor = async (userId: string): Promise<Record<string, number>> => {
  const rows = (await sequelize.query(
    `SELECT m.group_id AS "groupId", COUNT(*)::int AS unread
       FROM group_messages m
       JOIN group_members gm
         ON gm.group_id = m.group_id AND gm.user_id = :userId
       LEFT JOIN group_message_reads r
         ON r.group_id = m.group_id AND r.user_id = :userId
      WHERE m.author_id <> :userId
        AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(r.last_read_at, gm.joined_at)
      GROUP BY m.group_id`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  )) as Array<{ groupId: string; unread: number }>;

  return Object.fromEntries(rows.map((row) => [row.groupId, row.unread]));
};

/**
 * GET /api/groups/unread
 *
 * Sert la pastille de la navigation, qui ne doit pas charger toute la liste
 * des groupes pour afficher un nombre.
 */
export const getUnreadCounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const byGroup = await unreadCountsFor(userId);
    const total = Object.values(byGroup).reduce((sum, count) => sum + count, 0);

    res.json({ total, byGroup });
  } catch (error) {
    next(error);
  }
};

/** POST /api/groups/:id/messages/read */
export const markChatRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await openChat(req, res);
    if (!chat) return;

    const { upTo } = req.body as { upTo?: string };

    // GREATEST rend le marquage monotone : il ne peut que faire baisser le
    // compteur, jamais « delire » un message. LEAST contre now() empeche une
    // horloge client en avance de marquer lu ce qui n'existe pas encore.
    await sequelize.query(
      `INSERT INTO group_message_reads (group_id, user_id, last_read_at, updated_at)
       VALUES (:groupId, :userId, LEAST(:upTo::timestamptz, now()), now())
       ON CONFLICT (group_id, user_id) DO UPDATE
          SET last_read_at = GREATEST(group_message_reads.last_read_at, EXCLUDED.last_read_at),
              updated_at = now()`,
      {
        replacements: {
          groupId: chat.group.id,
          userId: chat.userId,
          upTo: upTo ?? new Date().toISOString(),
        },
      }
    );

    const byGroup = await unreadCountsFor(chat.userId);
    res.json({ unreadCount: byGroup[chat.group.id] ?? 0 });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:id/messages/image
 *
 * Route distincte de l'envoi texte plutot que POST /messages en multipart :
 * express.json() et multer ne cohabitent pas sur une meme route sans brancher
 * sur le Content-Type, et le chemin JSON est le chemin chaud. Meme decoupage
 * que /:id/avatar.
 */
export const sendImageMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await openChat(req, res);
    if (!chat) return;

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const key = await storage.save(file.buffer, file.mimetype, IMAGE_TYPES[file.mimetype]);

    // La legende est facultative et arrive en champ multipart. Vide, elle vaut
    // null : la contrainte de base accepte une image sans texte.
    const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';

    const created: any = await GroupMessage.create({
      groupId: chat.group.id,
      authorId: chat.userId,
      body: caption.length > 0 ? caption.slice(0, 2000) : null,
      imageUrl: `/api/media/${key}`,
    });

    const message = await withAuthor(created.id);
    const payload = serializeMessage(message);

    publishMessage(chat.group.id, payload);

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};
