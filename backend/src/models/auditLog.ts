import { DataTypes, Model, Optional } from 'sequelize';

interface AuditLogAttributes {
  id: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes,
  'id' | 'actorId' | 'targetId' | 'metadata' | 'createdAt'> {}

/** B-06 : journal des actions sensibles. En ecriture seule cote application. */
export class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes {
  public id!: string;
  public actorId?: string | null;
  public action!: string;
  public targetType!: string;
  public targetId?: string | null;
  public metadata!: Record<string, unknown>;
  public createdAt?: Date;

  public static initModel(sequelize: any) {
    return AuditLog.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        actorId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
        },
        action: { type: DataTypes.STRING(100), allowNull: false },
        targetType: { type: DataTypes.STRING(50), allowNull: false },
        targetId: { type: DataTypes.UUID, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      },
      {
        sequelize,
        tableName: 'audit_logs',
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: false,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'actorId', as: 'actor' });
  };
}
