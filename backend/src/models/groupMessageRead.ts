import { DataTypes, Model } from 'sequelize';

interface GroupMessageReadAttributes {
  groupId: string;
  userId: string;
  lastReadAt: Date;
  updatedAt?: Date;
}

/**
 * Filigrane de lecture du chat, un par membre et par groupe.
 *
 * Pas d'`id` de substitution : la clef primaire est le couple (groupId,
 * userId), comme pour notification_preferences.
 */
export class GroupMessageRead extends Model<GroupMessageReadAttributes, GroupMessageReadAttributes>
  implements GroupMessageReadAttributes {
  public groupId!: string;
  public userId!: string;
  public lastReadAt!: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return GroupMessageRead.init(
      {
        groupId: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          references: { model: 'groups', key: 'id' },
        },
        userId: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        lastReadAt: { type: DataTypes.DATE, allowNull: false },
      },
      {
        sequelize,
        tableName: 'group_message_reads',
        // Pas de created_at : la premiere lecture n'a pas d'interet propre,
        // seule compte la derniere.
        timestamps: true,
        createdAt: false,
        updatedAt: 'updatedAt',
      }
    );
  }

  public static associate = ({ GroupModel, UserModel }: any) => {
    this.belongsTo(GroupModel, { foreignKey: 'groupId', as: 'group' });
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}
