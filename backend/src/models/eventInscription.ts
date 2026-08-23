import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './index';

// Define the EventInscription attributes interface
interface EventInscriptionAttributes {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'waitlist' | 'cancelled';
  registeredAt?: Date;
  updatedAt?: Date;
}

// Define the EventInscription creation attributes
interface EventInscriptionCreationAttributes extends Optional<EventInscriptionAttributes,
  'id' | 'registeredAt' | 'updatedAt'> {}

// Define the EventInscription model
class EventInscription extends Model<EventInscriptionAttributes, EventInscriptionCreationAttributes>
  implements EventInscriptionAttributes {
  public id!: string;
  public eventId!: string;
  public userId!: string;
  public status!: 'pending' | 'confirmed' | 'waitlist' | 'cancelled';
  public registeredAt?: Date;
  public updatedAt?: Date;
}

// Initialize the EventInscription model
EventInscription.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'waitlist', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    registeredAt: {
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
    tableName: 'event_inscriptions',
    timestamps: false,
  }
);

// Define associations
EventInscription.associate = (models: any) => {
  EventInscription.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
  EventInscription.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
};

export default EventInscription;