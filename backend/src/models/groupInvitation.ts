import { DataTypes, Model, Optional } from 'sequelize';

export interface GroupInvitationAttributes {
  id: string;
  groupId: string;
  createdBy: string;
  token: string;
  role: 'admin' | 'member';
  expiresAt: Date;
  maxUses?: number | null;
  uses: number;
  revokedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GroupInvitationCreationAttributes
  extends Optional<
    GroupInvitationAttributes,
    'id' | 'token' | 'role' | 'maxUses' | 'uses' | 'revokedAt' | 'createdAt' | 'updatedAt'
  > {}

export class GroupInvitation
  extends Model<GroupInvitationAttributes, GroupInvitationCreationAttributes>
  implements GroupInvitationAttributes
{
  public id!: string;
  public groupId!: string;
  public createdBy!: string;
  public token!: string;
  public role!: 'admin' | 'member';
  public expiresAt!: Date;
  public maxUses?: number | null;
  public uses!: number;
  public revokedAt?: Date | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static associate: (models: any) => void;

  /** Une invitation est utilisable si elle n'est ni revoquee, ni expiree, ni epuisee. */
  public isUsable(now: Date = new Date()): boolean {
    if (this.revokedAt) return false;
    if (this.expiresAt.getTime() <= now.getTime()) return false;
    if (this.maxUses !== null && this.maxUses !== undefined && this.uses >= this.maxUses) {
      return false;
    }
    return true;
  }

  public static initModel(sequelize: any) {
    return GroupInvitation.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        groupId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'groups', key: 'id' },
        },
        createdBy: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        token: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          unique: true,
        },
        role: {
          type: DataTypes.ENUM('admin', 'member'),
          allowNull: false,
          defaultValue: 'member',
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        maxUses: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        uses: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        revokedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'group_invitations',
        timestamps: true,
      }
    );
  }
}
