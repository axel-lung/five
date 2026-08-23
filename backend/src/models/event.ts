import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './index';

// Define the Event attributes interface
interface EventAttributes {
  id: string;
  title: string;
  description?: string;
  dateTime: Date;
  location?: string;
  capacity: number;
  level?: string;
  price?: number;
  status: 'draft' | 'open' | 'full' | 'completed' | 'cancelled';
  organizerId: string;
  groupId?: string;
  shareableLinkToken: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the Event creation attributes
interface EventCreationAttributes extends Optional<EventAttributes,
  'id' | 'description' | 'location' | 'level' | 'price' | 'groupId' |
  'shareableLinkToken' | 'createdAt' | 'updatedAt'> {}

// Define the Event model
class Event extends Model<EventAttributes, EventCreationAttributes>
  implements EventAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public dateTime!: Date;
  public location?: string;
  public capacity!: number;
  public level?: string;
  public price?: number;
  public status!: 'draft' | 'open' | 'full' | 'completed' | 'cancelled';
  public organizerId!: string;
  public groupId?: string;
  public shareableLinkToken!: string;
  public createdAt?: Date;
  public updatedAt?: Date;
}

// Initialize the Event model
Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dateTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    level: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'open', 'full', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    organizerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    groupId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'groups',
        key: 'id',
      },
    },
    shareableLinkToken: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
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
    tableName: 'events',
    timestamps: false,
  }
);

// Define associations
Event.associate = (models: any) => {
  Event.belongsTo(models.User, { foreignKey: 'organizerId', as: 'organizer' });
  Event.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
  Event.hasMany(models.EventInscription, { foreignKey: 'eventId', as: 'inscriptions' });
};

export default Event;