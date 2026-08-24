import { DataTypes, Model, Optional } from 'sequelize';

// Define the User attributes
export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  city?: string;
  preferredPosition?: string;
  selfDeclaredLevel?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  deletedAt?: Date | null;
  consentTosAt?: Date | null;
  consentMarketingAt?: Date | null;
  emailVerificationToken?: string | null;
  emailVerificationSentAt?: Date | null;
  role?: 'user' | 'admin';
  preferredSlots?: string[];
  travelRadiusKm?: number | null;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the User creation attributes
export interface UserCreationAttributes extends Optional<UserAttributes,
  'id' | 'avatarUrl' | 'bio' | 'city' | 'preferredPosition' | 'selfDeclaredLevel' |
  'emailVerified' | 'phoneVerified' | 'createdAt' | 'updatedAt'> {}

// Define the User model
export class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public firstName?: string;
  public lastName?: string;
  public phone?: string;
  public avatarUrl?: string;
  public bio?: string;
  public city?: string;
  public preferredPosition?: string;
  public selfDeclaredLevel?: number;
  public emailVerified?: boolean;
  public phoneVerified?: boolean;
  public deletedAt?: Date | null;
  public consentTosAt?: Date | null;
  public consentMarketingAt?: Date | null;
  public emailVerificationToken?: string | null;
  public emailVerificationSentAt?: Date | null;
  public role?: 'user' | 'admin';
  public preferredSlots?: string[];
  public travelRadiusKm?: number | null;
  public suspendedAt?: Date | null;
  public suspensionReason?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  // Initialize the User model
  public static initModel(sequelize: any) {
    return User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
        },
        passwordHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        firstName: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        lastName: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        avatarUrl: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        bio: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        city: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        preferredPosition: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        selfDeclaredLevel: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        emailVerified: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        phoneVerified: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        // C-06 : un compte efface est anonymise sur place, jamais supprime.
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        consentTosAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        consentMarketingAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        emailVerificationToken: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        emailVerificationSentAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        // B-01 : aucune route n'ecrit ce champ, par choix. Voir migration 0006.
        role: {
          type: DataTypes.ENUM('user', 'admin'),
          allowNull: false,
          defaultValue: 'user',
        },
        suspendedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        suspensionReason: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        // C-03 : creneaux preferes, ex. ['mardi-soir', 'jeudi-soir'].
        preferredSlots: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        travelRadiusKm: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'users',
        timestamps: true,
      }
    );
  }

  // Associate method to be called from index.ts
  public static associate = ({ GroupModel, EventModel, EventInscriptionModel }: any) => {
    this.hasMany(GroupModel, { foreignKey: 'ownerId', as: 'ownedGroups' });
    this.belongsToMany(GroupModel, {
      through: 'group_members',
      foreignKey: 'userId',
      otherKey: 'groupId',
      as: 'groups'
    });
    this.hasMany(EventModel, { foreignKey: 'organizerId', as: 'organizedEvents' });
    this.hasMany(EventInscriptionModel, { foreignKey: 'userId', as: 'eventInscriptions' });
    this.belongsToMany(EventModel, {
      through: EventInscriptionModel,
      foreignKey: 'userId',
      otherKey: 'eventId',
      as: 'events'
    });
  };
}