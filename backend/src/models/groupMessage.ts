import { DataTypes, Model, Optional } from 'sequelize';

interface GroupMessageAttributes {
  id: string;
  groupId: string;
  authorId: string;
  body?: string | null;
  imageUrl?: string | null;
  clientNonce?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GroupMessageCreationAttributes extends Optional<GroupMessageAttributes,
  'id' | 'body' | 'imageUrl' | 'clientNonce' | 'deletedAt' | 'deletedBy' | 'createdAt' | 'updatedAt'> {}

export class GroupMessage extends Model<GroupMessageAttributes, GroupMessageCreationAttributes>
  implements GroupMessageAttributes {
  public id!: string;
  public groupId!: string;
  public authorId!: string;
  public body?: string | null;
  public imageUrl?: string | null;
  public clientNonce?: string | null;
  public deletedAt?: Date | null;
  public deletedBy?: string | null;
  public createdAt?: Date;
  public updatedAt?: Date;

  public static initModel(sequelize: any) {
    return GroupMessage.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        groupId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'groups', key: 'id' },
        },
        authorId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        body: { type: DataTypes.TEXT, allowNull: true },
        imageUrl: { type: DataTypes.TEXT, allowNull: true },
        clientNonce: { type: DataTypes.UUID, allowNull: true },
        deletedAt: { type: DataTypes.DATE, allowNull: true },
        deletedBy: { type: DataTypes.UUID, allowNull: true },
      },
      {
        sequelize,
        tableName: 'group_messages',
        timestamps: true,
        // Surtout PAS `paranoid: true` malgre la presence d'un deletedAt : le
        // mode paranoid de Sequelize retire automatiquement les lignes
        // supprimees de toutes les requetes, l'exact inverse de ce que veut
        // une pierre tombale — qui doit continuer a s'afficher et a voyager
        // dans le delta de reconnexion. La colonne se gere a la main.
        paranoid: false,
      }
    );
  }

  public static associate = ({ GroupModel, UserModel }: any) => {
    this.belongsTo(GroupModel, { foreignKey: 'groupId', as: 'group' });
    this.belongsTo(UserModel, { foreignKey: 'authorId', as: 'author' });
    // Qui a supprime : l'auteur lui-meme ou un admin du groupe. Les deux se
    // libellent differemment cote client.
    this.belongsTo(UserModel, { foreignKey: 'deletedBy', as: 'remover' });
  };
}
