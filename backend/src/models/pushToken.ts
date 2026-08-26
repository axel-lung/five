import { DataTypes, Model, Optional } from 'sequelize';

interface PushTokenAttributes {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  timezone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PushTokenCreationAttributes extends Optional<PushTokenAttributes,
  'id' | 'timezone' | 'createdAt' | 'updatedAt'> {}

/** N-01 : un appareil joignable par push. */
export class PushToken extends Model<PushTokenAttributes, PushTokenCreationAttributes>
  implements PushTokenAttributes {
  public id!: string;
  public userId!: string;
  public token!: string;
  public platform!: 'ios' | 'android' | 'web';
  public timezone?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return PushToken.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        token: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        platform: {
          type: DataTypes.ENUM('ios', 'android', 'web'),
          allowNull: false,
        },
        timezone: { type: DataTypes.STRING(64), allowNull: true },
      },
      {
        sequelize,
        tableName: 'push_tokens',
        timestamps: true,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}
