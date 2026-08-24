import { DataTypes, Model, Optional } from 'sequelize';

interface NotificationAttributes {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt?: Date | null;
  createdAt?: Date;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes,
  'id' | 'payload' | 'readAt' | 'createdAt'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes {
  public id!: string;
  public userId!: string;
  public type!: string;
  public payload!: Record<string, unknown>;
  public readAt?: Date | null;
  public createdAt?: Date;

  public static initModel(sequelize: any) {
    return Notification.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        type: { type: DataTypes.STRING(50), allowNull: false },
        payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        readAt: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        tableName: 'notifications',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: false,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}
