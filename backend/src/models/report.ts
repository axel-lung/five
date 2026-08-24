import { DataTypes, Model, Optional } from 'sequelize';

interface ReportAttributes {
  id: string;
  reporterId: string;
  targetType: 'user' | 'group' | 'event';
  targetId: string;
  reason: string;
  details?: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReportCreationAttributes extends Optional<ReportAttributes,
  'id' | 'details' | 'status' | 'createdAt' | 'updatedAt'> {}

export class Report extends Model<ReportAttributes, ReportCreationAttributes>
  implements ReportAttributes {
  public id!: string;
  public reporterId!: string;
  public targetType!: 'user' | 'group' | 'event';
  public targetId!: string;
  public reason!: string;
  public details?: string | null;
  public status!: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return Report.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        reporterId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        targetType: {
          type: DataTypes.ENUM('user', 'group', 'event'),
          allowNull: false,
        },
        targetId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        reason: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        details: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('open', 'reviewing', 'resolved', 'dismissed'),
          allowNull: false,
          defaultValue: 'open',
        },
      },
      {
        sequelize,
        tableName: 'reports',
        timestamps: true,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'reporterId', as: 'reporter' });
  };
}
