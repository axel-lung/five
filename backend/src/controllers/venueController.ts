import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { VenueModel as Venue } from '../models';
import { audit } from '../services/audit';

/**
 * PA-03 : catalogue des complexes, consultable par tout compte connecte —
 * un organisateur doit pouvoir choisir son lieu au moment de creer sa
 * session.
 */
export const listVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { active: true };

    const city = (req.query.city as string)?.trim();
    if (city) {
      where.city = { [Op.iLike]: `%${city}%` };
    }

    const venues = await Venue.findAll({ where, order: [['name', 'ASC']], limit: 100 });

    res.json(venues);
  } catch (error) {
    next(error);
  }
};

/**
 * PA-03 : referencer un complexe. Reserve au back-office : le catalogue
 * engage la relation partenaire, il n'est pas alimente par les joueurs.
 */
export const createVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address, city, isPartner } = req.body;

    const venue = await Venue.create({ name, address, city, isPartner });
    await audit((req as any).user.id, 'admin.venue.create', 'venue', venue.id, { name });

    res.status(201).json(venue);
  } catch (error) {
    next(error);
  }
};

/** PA-03 : retirer un complexe du catalogue sans effacer son historique. */
export const deactivateVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    await venue.update({ active: false });
    await audit((req as any).user.id, 'admin.venue.deactivate', 'venue', venue.id);

    res.json({ message: 'Venue deactivated' });
  } catch (error) {
    next(error);
  }
};
