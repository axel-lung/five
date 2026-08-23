import { Request, Response, NextFunction } from 'express';
import { Event, User, Group, EventInscription } from '../models/index';
import { Op } from 'sequelize';
import { validateRequest } from '../utils/validationSchemas';
import { createEventSchema } from '../utils/validationSchemas';

// Create a new event
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
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
    // Get query parameters for filtering
    const { date, city, level } = req.query;

    // Build where clause
    const whereClause: any = { status: 'open' }; // Only show open events by default

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
        { model: User, as: 'organizer', attributes: { exclude: ['passwordHash'] } },
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
    const event = await Event.findByPk(eventId, {
      include: [
        { model: User, as: 'organizer', attributes: { exclude: ['passwordHash'] } },
        { model: Group, as: 'group' },
        {
          model: User,
          as: 'participants',
          through: {
            model: EventInscription,
            as: 'inscription',
            attributes: ['status', 'registeredAt']
          },
          attributes: { exclude: ['passwordHash'] }
        }
      ]
    });

    if (!event) {
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
    const userId = req.user.id;

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
        { model: User, as: 'organizer', attributes: { exclude: ['passwordHash'] } },
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
    const userId = req.user.id;

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

// Join an event (create inscription)
export const joinEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;

    // Find event
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event is still open for registration
    if (event.status !== 'open') {
      return res.status(400).json({ message: 'Event is not open for registration' });
    }

    // Check if user already registered
    const existingInscription = await EventInscription.findOne({
      where: { eventId, userId }
    });

    if (existingInscription) {
      return res.status(400).json({ message: 'You are already registered for this event' });
    }

    // Count confirmed participants
    const confirmedCount = await EventInscription.count({
      where: {
        eventId,
        status: 'confirmed'
      }
    });

    // Determine status: confirmed if there's space, otherwise waitlist
    const status = confirmedCount < event.capacity ? 'confirmed' : 'waitlist';

    // Create inscription
    const inscription = await EventInscription.create({
      eventId,
      userId,
      status,
    });

    res.status(201).json(inscription);
  } catch (error) {
    next(error);
  }
};

// Leave an event (cancel inscription)
export const leaveEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;

    // Find inscription
    const inscription = await EventInscription.findOne({
      where: { eventId, userId }
    });

    if (!inscription) {
      return res.status(404).json({ message: 'You are not registered for this event' });
    }

    // Update status to cancelled
    await inscription.update({ status: 'cancelled' });

    res.json({ message: 'You have left the event' });
  } catch (error) {
    next(error);
  }
};

// Get participants of an event
export const getEventParticipants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;

    // Find event
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const participants = await EventInscription.findAll({
      where: { eventId, status: 'confirmed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: { exclude: ['passwordHash'] }
        }
      ],
      order: [['registeredAt', 'ASC']]
    });

    res.json(participants);
  } catch (error) {
    next(error);
  }
};