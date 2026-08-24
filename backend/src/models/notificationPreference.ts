import { DataTypes, Model, Optional } from 'sequelize';

interface NotificationPreferenceAttributes {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationPreferenceCreationAttributes extends Optional<NotificationPreferenceAttributes,
  'pushEnabled' | 'emailEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'createdAt' | 'updatedAt'> {}

export class NotificationPreference
  extends Model<NotificationPreferenceAttributes, NotificationPreferenceCreationAttributes>
  implements NotificationPreferenceAttributes {
  public userId!: string;
  public pushEnabled!: boolean;
  public emailEnabled!: boolean;
  public quietHoursStart?: number | null;
  public quietHoursEnd?: number | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return NotificationPreference.init(
      {
        // La cle primaire EST l'utilisateur : une seule ligne de preferences
        // par compte, pas d'id technique a maintenir.
        userId: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        pushEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        emailEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        quietHoursStart: { type: DataTypes.INTEGER, allowNull: true },
        quietHoursEnd: { type: DataTypes.INTEGER, allowNull: true },
      },
      {
        sequelize,
        tableName: 'notification_preferences',
        timestamps: true,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}
