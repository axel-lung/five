import { Joi } from 'joi';

// Registration validation schema
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  city: Joi.string().max(100).optional(),
});

// Login validation schema
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Update profile validation schema
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  avatarUrl: Joi.string().uri().optional(),
  bio: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  preferredPosition: Joi.string().max(50).optional(),
  selfDeclaredLevel: Joi.number().min(1).max(5).optional(),
});

// Create group validation schema
export const createGroupSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional(),
  city: Joi.string().max(100).optional(),
  accessType: Joi.string().valid('private', 'public').default('private'),
});

// Create event validation schema
export const createEventSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional(),
  dateTime: Joi.date().iso().required(),
  location: Joi.string().max(255).optional(),
  capacity: Joi.number().integer().min(1).max(50).required(),
  level: Joi.string().max(50).optional(),
  price: Joi.number().precision(2).min(0).optional(),
  groupId: Joi.string().uuid().optional(),
});

// Helper function for Joi validation middleware
export const validateRequest = (schema: any) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => detail.message)
      });
    }
    next();
  };
};