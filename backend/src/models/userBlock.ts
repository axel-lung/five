import { DataTypes, Model, Optional } from 'sequelize';

interface UserBlockAttributes {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt?: Date;
}

interface UserBlockCreationAttributes extends Optional<UserBlockAttributes, 'id' | 'createdAt'> {}

export class UserBlock extends Model<UserBlockAttributes, UserBlockCreationAttributes>
  implements UserBlockAttributes {
  public id!: string;
  public blockerId!: string;
  public blockedId!: string;
  public createdAt?: Date;

  public static initModel(sequelize: any) {
    return UserBlock.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        blockerId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        blockedId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
      },
      {
        sequelize,
        tableName: 'user_blocks',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: false,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'blockerId', as: 'blocker' });
    this.belongsTo(UserModel, { foreignKey: 'blockedId', as: 'blocked' });
  };
}
