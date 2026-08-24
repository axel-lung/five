import { DataTypes, Model, Optional } from 'sequelize';

interface VenueAttributes {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  isPartner: boolean;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface VenueCreationAttributes extends Optional<VenueAttributes,
  'id' | 'address' | 'city' | 'isPartner' | 'active' | 'createdAt' | 'updatedAt'> {}

/** PA-03 : complexe auquel une session peut etre rattachee. */
export class Venue extends Model<VenueAttributes, VenueCreationAttributes>
  implements VenueAttributes {
  public id!: string;
  public name!: string;
  public address?: string | null;
  public city?: string | null;
  public isPartner!: boolean;
  public active!: boolean;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return Venue.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING(255), allowNull: false },
        address: { type: DataTypes.STRING(255), allowNull: true },
        city: { type: DataTypes.STRING(100), allowNull: true },
        isPartner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      {
        sequelize,
        tableName: 'venues',
        timestamps: true,
      }
    );
  }

  public static associate = ({ EventModel }: any) => {
    this.hasMany(EventModel, { foreignKey: 'venueId', as: 'events' });
  };
}
