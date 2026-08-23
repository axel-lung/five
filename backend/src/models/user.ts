import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './index';

// Define the User attributes interface
interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  city?: string;
  preferredPosition?: string;
  selfDeclaredLevel?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the User creation attributes (what's needed to create a User)
interface UserCreationAttributes extends Optional<UserAttributes,
  'id' | 'avatarUrl' | 'bio' | 'city' | 'preferredPosition' | 'selfDeclaredLevel' |
  'emailVerified' | 'phoneVerified' | 'createdAt' | 'updatedAt'> {}

// Define the User model
class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public firstName?: string;
  public lastName?: string;
  public phone?: string;
  public avatarUrl?: string;
  public bio?: string;
  public city?: string;
  public preferredPosition?: string;
  public selfDeclaredLevel?: number;
  public emailVerified?: boolean;
  public phoneVerified?: boolean;
  public createdAt?: Date;
  public updatedAt?: Date;
}

// Initialize the User model
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    preferredPosition: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    selfDeclaredLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: false, // We're handling timestamps manually
  }
);

// Define associations (will be implemented in the index.ts file)
// User.associate = (models: any) => {
//   User.hasMany(models.Group, { foreignKey: 'ownerId', as: 'ownedGroups' });
//   User.belongsToMany(models.Group, {
//     through: 'group_members',
//     foreignKey: 'userId',
//     otherKey: 'groupId',
//     as: 'groups'
//   });
//   User.hasMany(models.Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
//   User.hasMany(models.EventInscription, { foreignKey: 'userId', as: 'eventInscriptions' });
// };

export default User;