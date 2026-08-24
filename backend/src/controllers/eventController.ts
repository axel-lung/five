import { Request, Response, NextFunction } from 'express';
import {
  EventModel as Event,
  UserModel as User,
  GroupModel as Group,
  GroupMemberModel as GroupMember,
  EventInscriptionModel as EventInscription,
  sequelize,
} from '../models';
import { Op } from 'sequelize';
import { createEventSchema } from '../utils/validationSchemas';
import { PUBLIC_USER_ATTRIBUTES } from '../utils/publicAttributes';
import { cancelInscription, syncCapacityStatus } from '../services/inscriptions';

/**
 * G-06 / C-04 : un evenement rattache a un groupe prive ne regarde que ses
 * membres. Meme regle que canViewGroup cote groupes, appliquee ici a
 * l'evenement via son groupe.
 *
 * Un evenement sans groupe reste visible : il n'existe que par son lien
 * partageable (E-07), et la recherche de sessions ouvertes (D-01) est ciblee
 * V1.5. L'organisateur voit toujours le sien, y compris en brouillon.
 */
const canViewEvent = async (event: any, userId: string): Promise<boolean> => {
  if (event.organizerId === userId) return true;
  if (!event.groupId) return true;

  const group = await Group.findByPk(event.groupId);
  if (!group) return true;
  if (group.accessType === 'public') return true;

  const membership = await GroupMember.findOne({ where: { groupId: group.id, userId } });
  return membership !== null;
};

/** Les groupes dont l'appelant peut voir les evenements : les siens + les publics. */
const visibleGroupIds = async (userId: string): Promise<string[]> => {
  const memberships = await GroupMember.findAll({
    where: { userId },
    attributes: ['groupId'],
  });

  const groups = await Group.findAll({
    where: {
      [Op.or]: [
        { id: { [Op.in]: memberships.map((m: any) => m.groupId) } },
        { accessType: 'public' },
      ],
    },
    attributes: ['id'],
  });

  return groups.map((g: any) => g.id);
};

// Create a new event
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { error } = createEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message)
      });
    }

    const { title, description, dateTime, location, capacity, level, price, groupId } = req.body;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If groupId is provided, check if user owns the group
    if (groupId) {
      const group = await Group.findByPk(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      if (group.ownerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to create event for this group' });
      }
    }

    // Create event
    const event = await Event.create({
      title,
      description,
      dateTime: new Date(dateTime),
      location,
      capacity,
      level,
      price,
      status: 'open', // Default status for new events
      organizerId: userId,
      groupId: groupId || null,
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

// Get all events (with filtering and pagination - simplified for V0)
export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    // Get query parameters for filtering
    const { date, city, level } = req.query;

    // Build where clause
    // 'full' doit rester visible : un evenement complet interesse toujours,
    // ne serait-ce que pour rejoindre la liste d'attente. Seuls draft,
    // completed et cancelled sont masques.
    const whereClause: any = {
      status: { [Op.in]: ['open', 'full'] },
      // Sans ce filtre, la liste renvoyait les evenements de TOUS les groupes,
      // prives compris, a n'importe quel compte authentifie.
      [Op.or]: [
        { groupId: null },
        { groupId: { [Op.in]: await visibleGroupIds(userId) } },
        { organizerId: userId },
      ],
    };

    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      whereClause.dateTime = {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      };
    }

    // Note: For city and level filtering, we'd need to join with groups or add these fields to events
    // For simplicity in V0, we'll just get all open events

    const events = await Event.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'organizer', attributes: PUBLIC_USER_ATTRIBUTES },
        { model: Group, as: 'group' }
      ],
      order: [['dateTime', 'ASC']]
    });

    res.json(events);
  } catch (error) {
    next(error);
  }
};

// Get a specific event by ID
export const getEventById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    const event = await Event.findByPk(eventId, {
      include: [
        { model: User, as: 'organizer', attributes: PUBLIC_USER_ATTRIBUTES },
        { model: Group, as: 'group' },
        {
          model: User,
          as: 'participants',
          attributes: PUBLIC_USER_ATTRIBUTES
        }
      ]
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // 404 plutot que 403 : l'existence d'un evenement de groupe prive ne
    // regarde pas les non-membres, comme pour getGroupById.
    if (!(await canViewEvent(event, userId))) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    next(error);
  }
};

// Update an event
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    // Find event and check ownership
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    const { title, description, dateTime, location, capacity, level, price, groupId } = req.body;

    // If groupId is provided and changed, check ownership
    if (groupId && groupId !== event.groupId) {
      const group = await Group.findByPk(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      if (group.ownerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to use this group' });
      }
    }

    await event.update({
      title,
      description,
      dateTime: dateTime ? new Date(dateTime) : event.dateTime,
      location,
      capacity,
      level,
      price,
      groupId: groupId || null,
    });

    const updatedEvent = await Event.findByPk(eventId, {
      include: [
        { model: User, as: 'organizer', attributes: PUBLIC_USER_ATTRIBUTES },
        { model: Group, as: 'group' }
      ]
    });

    res.json(updatedEvent);
  } catch (error) {
    next(error);
  }
};

// Delete an event
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    // Find event and check ownership
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await event.destroy();
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * E-03 : rejoindre un evenement.
 *
 * Toute l'operation tient dans une transaction avec verrou exclusif sur la
 * ligne evenement (SELECT ... FOR UPDATE) : sans ce verrou, deux inscriptions
 * simultanees lisent le meme compteur et confirment toutes deux la derniere
 * place. La contrainte unique (event_id, user_id) reste le filet de securite.
 */
export const joinEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    const result = await sequelize.transaction(async (t) => {
      const event = await Event.findByPk(eventId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!event) {
        return { error: { code: 404, message: 'Event not found' } };
      }

      if (event.status !== 'open' && event.status !== 'full') {
        return { error: { code: 400, message: 'Event is not open for registration' } };
      }

      const existing = await EventInscription.findOne({
        where: { eventId, userId },
        transaction: t,
      });

      // Une inscription annulee peut etre reprise : on la reactive plutot que
      // d'en creer une seconde, que la contrainte unique refuserait.
      if (existing && existing.status !== 'cancelled') {
        return { error: { code: 400, message: 'You are already registered for this event' } };
      }

      const confirmedCount = await EventInscription.count({
        where: { eventId, status: 'confirmed' },
        transaction: t,
      });

      const status = confirmedCount < event.capacity ? 'confirmed' : 'waitlist';

      const inscription = existing
        ? await existing.update({ status }, { transaction: t })
        : await EventInscription.create({ eventId, userId, status }, { transaction: t });

      await syncCapacityStatus(event, t);

      return { inscription };
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.status(201).json(result.inscription);
  } catch (error) {
    next(error);
  }
};

/**
 * E-03 : se desister.
 *
 * Liberer une place confirmee promeut automatiquement le premier inscrit en
 * liste d'attente, dans l'ordre d'inscription. Sans cela la liste d'attente ne
 * se vide jamais et les places liberees restent perdues.
 */
export const leaveEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    const result = await sequelize.transaction(async (t) => {
      const event = await Event.findByPk(eventId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!event) {
        return { error: { code: 404, message: 'Event not found' } };
      }

      const inscription = await EventInscription.findOne({
        where: { eventId, userId },
        transaction: t,
      });

      if (!inscription || inscription.status === 'cancelled') {
        return { error: { code: 404, message: 'You are not registered for this event' } };
      }

      const promotedUserId = await cancelInscription(event, inscription, t);

      return { promotedUserId };
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.json({
      message: 'You have left the event',
      promotedUserId: result.promotedUserId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * E-02 : transitions de statut reservees a l'organisateur.
 * 'full' est exclu du schema de validation : il est derive de la capacite.
 */
export const updateEventStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;
    const { status } = req.body;

    const result = await sequelize.transaction(async (t) => {
      const event = await Event.findByPk(eventId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!event) {
        return { error: { code: 404, message: 'Event not found' } };
      }

      if (event.organizerId !== userId) {
        return { error: { code: 403, message: 'Not authorized to update this event' } };
      }

      if (event.status === 'cancelled') {
        return { error: { code: 400, message: 'A cancelled event cannot change status' } };
      }

      await event.update({ status }, { transaction: t });

      // Passer en 'open' peut immediatement rebasculer en 'full' si la
      // capacite est deja atteinte.
      if (status === 'open') {
        await syncCapacityStatus(event, t);
      }

      return { event };
    });

    if (result.error) {
      return res.status(result.error.code).json({ message: result.error.message });
    }

    res.json(result.event);
  } catch (error) {
    next(error);
  }
};

/**
 * E-07 : resume public d'un evenement via son lien partageable.
 *
 * Route non authentifiee : la reponse ne doit exposer aucune donnee
 * personnelle des participants, seulement de quoi decider de s'inscrire.
 */
export const getSharedEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await Event.findOne({
      where: { shareableLinkToken: req.params.token },
      include: [
        { model: User, as: 'organizer', attributes: ['firstName'] },
        { model: Group, as: 'group', attributes: ['name', 'city'] },
      ],
    });

    // Un evenement en brouillon n'est pas encore partage : on renvoie 404
    // plutot que 403, pour ne pas confirmer l'existence du token.
    if (!event || event.status === 'draft') {
      return res.status(404).json({ message: 'Event not found' });
    }

    const confirmedCount = await EventInscription.count({
      where: { eventId: event.id, status: 'confirmed' },
    });

    res.json({
      id: event.id,
      title: event.title,
      description: event.description,
      dateTime: event.dateTime,
      location: event.location,
      capacity: event.capacity,
      level: event.level,
      price: event.price,
      status: event.status,
      confirmedCount,
      spotsLeft: Math.max(0, event.capacity - confirmedCount),
      organizer: (event as any).organizer,
      group: (event as any).group,
    });
  } catch (error) {
    next(error);
  }
};

// Get participants of an event
export const getEventParticipants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = (req as any).user.id;

    // Find event
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!(await canViewEvent(event, userId))) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const participants = await EventInscription.findAll({
      where: { eventId, status: 'confirmed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: PUBLIC_USER_ATTRIBUTES
        }
      ],
      order: [['registeredAt', 'ASC']]
    });

    res.json(participants);
  } catch (error) {
    next(error);
  }
};