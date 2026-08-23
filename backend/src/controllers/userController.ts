import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user';
import { validateRequest } from '../utils/validationSchemas';
import { updateProfileSchema } from '../utils/validationSchemas';

// Get user profile
export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message)
      });
    }

    const { firstName, lastName, phone, avatarUrl, bio, city, preferredPosition, selfDeclaredLevel } = req.body;

    const [updated] = await User.update(
      {
        firstName,
        lastName,
        phone,
        avatarUrl,
        bio,
        city,
        preferredPosition,
        selfDeclaredLevel,
      },
      { where: { id: userId } }
    );

    if (updated === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] }
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};