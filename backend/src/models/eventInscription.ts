import { DataTypes, Model, Optional } from 'sequelize';

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
export class EventInscription extends Model<EventInscriptionAttributes, EventInscriptionCreationAttributes>
  implements EventInscriptionAttributes {
  public id!: string;
  public eventId!: string;
  public userId!: string;
  public status!: 'pending' | 'confirmed' | 'waitlist' | 'cancelled';
  public registeredAt?: Date;
  public updatedAt?: Date;

  // Initialize the EventInscription model
  public static initModel(sequelize: any) {
    return EventInscription.init(
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
      },
      {
        sequelize,
        tableName: 'event_inscriptions',
        timestamps: true,
        createdAt: 'registeredAt',
        updatedAt: 'updatedAt',
      }
    );
  }

  // Associate method to be called from index.ts
  public static associate = ({ EventModel, UserModel }: any) => {
    this.belongsTo(EventModel, { foreignKey: 'eventId', as: 'event' });
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}

// Associations will be defined in index.ts