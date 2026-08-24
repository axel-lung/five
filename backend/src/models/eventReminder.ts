import { DataTypes, Model, Optional } from 'sequelize';

interface EventReminderAttributes {
  id: string;
  eventId: string;
  sentBy: string;
  recipientCount: number;
  createdAt?: Date;
}

interface EventReminderCreationAttributes extends Optional<EventReminderAttributes,
  'id' | 'recipientCount' | 'createdAt'> {}

/** N-03 : trace des relances, pour en plafonner la frequence. */
export class EventReminder extends Model<EventReminderAttributes, EventReminderCreationAttributes>
  implements EventReminderAttributes {
  public id!: string;
  public eventId!: string;
  public sentBy!: string;
  public recipientCount!: number;
  public createdAt?: Date;

  public static initModel(sequelize: any) {
    return EventReminder.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        eventId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'events', key: 'id' },
        },
        sentBy: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        recipientCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        tableName: 'event_reminders',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: false,
      }
    );
  }

  public static associate = ({ EventModel, UserModel }: any) => {
    this.belongsTo(EventModel, { foreignKey: 'eventId', as: 'event' });
    this.belongsTo(UserModel, { foreignKey: 'sentBy', as: 'sender' });
  };
}
