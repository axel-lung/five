import { DataTypes, Model, Optional } from 'sequelize';

// Define the Group attributes interface
interface GroupAttributes {
  id: string;
  name: string;
  description?: string;
  city?: string;
  avatarUrl?: string;
  accessType: 'private' | 'public';
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the Group creation attributes
interface GroupCreationAttributes extends Optional<GroupAttributes,
  'id' | 'description' | 'city' | 'avatarUrl' | 'createdAt' | 'updatedAt'> {}

// Define the Group model
export class Group extends Model<GroupAttributes, GroupCreationAttributes>
  implements GroupAttributes {
  public id!: string;
  public name!: string;
  public description?: string;
  public city?: string;
  public avatarUrl?: string;
  public accessType!: 'private' | 'public';
  public ownerId!: string;
  public createdAt?: Date;
  public updatedAt?: Date;

  // Initialize the Group model
  public static initModel(sequelize: any) {
    return Group.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        city: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        avatarUrl: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        accessType: {
          type: DataTypes.ENUM('private', 'public'),
          allowNull: false,
          defaultValue: 'private',
        },
        ownerId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'groups',
        timestamps: false,
      }
    );
  }

  // Associate method to be called from index.ts
  public static associate = ({ User, Event }: any) => {
    this.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
    this.belongsToMany(User, {
      through: 'group_members',
      foreignKey: 'groupId',
      otherKey: 'userId',
      as: 'members'
    });
    this.hasMany(Event, { foreignKey: 'groupId', as: 'events' });
  };
}

// Associations will be defined in index.ts