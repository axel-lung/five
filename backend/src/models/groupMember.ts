import { DataTypes, Model, Optional } from 'sequelize';

// Define the GroupMember attributes interface
interface GroupMemberAttributes {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: Date;
}

// Define the GroupMember creation attributes
interface GroupMemberCreationAttributes extends Optional<GroupMemberAttributes,
  'id' | 'joinedAt'> {}

// Define the GroupMember model
export class GroupMember extends Model<GroupMemberAttributes, GroupMemberCreationAttributes>
  implements GroupMemberAttributes {
  public id!: string;
  public groupId!: string;
  public userId!: string;
  public role!: 'owner' | 'admin' | 'member';
  public joinedAt?: Date;

  // Initialize the GroupMember model
  public static initModel(sequelize: any) {
    return GroupMember.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        groupId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'groups',
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
        role: {
          type: DataTypes.ENUM('owner', 'admin', 'member'),
          allowNull: false,
          defaultValue: 'member',
        },
        joinedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'group_members',
        timestamps: false,
      }
    );
  }

  // Associate method to be called from index.ts
  public static associate = ({ GroupModel, UserModel }: any) => {
    this.belongsTo(GroupModel, { foreignKey: 'groupId', as: 'group' });
    this.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  };
}

// Associations will be defined in index.ts