import { DataTypes, Model, Optional } from 'sequelize';

export type BugReportKind = 'bug' | 'display' | 'suggestion';
export type BugReportSeverity = 'blocking' | 'major' | 'minor';
export type BugReportStatus = 'open' | 'investigating' | 'fixed' | 'dismissed';

interface BugReportAttributes {
  id: string;
  reporterId: string;
  kind: BugReportKind;
  severity: BugReportSeverity;
  description: string;
  /** Contexte technique capture par le client : url, userAgent, viewport. */
  context: Record<string, unknown>;
  status: BugReportStatus;
  handledBy?: string | null;
  resolutionNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BugReportCreationAttributes extends Optional<BugReportAttributes,
  'id' | 'kind' | 'severity' | 'context' | 'status' | 'handledBy' | 'resolutionNote'
  | 'createdAt' | 'updatedAt'> {}

/** Beta : anomalie declaree par un testeur depuis l'ecran ou elle survient. */
export class BugReport extends Model<BugReportAttributes, BugReportCreationAttributes>
  implements BugReportAttributes {
  public id!: string;
  public reporterId!: string;
  public kind!: BugReportKind;
  public severity!: BugReportSeverity;
  public description!: string;
  public context!: Record<string, unknown>;
  public status!: BugReportStatus;
  public handledBy?: string | null;
  public resolutionNote?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return BugReport.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        reporterId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        kind: {
          type: DataTypes.ENUM('bug', 'display', 'suggestion'),
          allowNull: false,
          defaultValue: 'bug',
        },
        severity: {
          type: DataTypes.ENUM('blocking', 'major', 'minor'),
          allowNull: false,
          defaultValue: 'major',
        },
        description: { type: DataTypes.TEXT, allowNull: false },
        context: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        status: {
          type: DataTypes.ENUM('open', 'investigating', 'fixed', 'dismissed'),
          allowNull: false,
          defaultValue: 'open',
        },
        handledBy: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
        },
        resolutionNote: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: 'bug_reports',
        timestamps: true,
      }
    );
  }

  public static associate = ({ UserModel }: any) => {
    this.belongsTo(UserModel, { foreignKey: 'reporterId', as: 'reporter' });
    this.belongsTo(UserModel, { foreignKey: 'handledBy', as: 'handler' });
  };
}
