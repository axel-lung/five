import { Sequelize, DataTypes, Model } from 'sequelize';
import { User } from './user';
import { Group } from './group';
import { Event } from './event';
import { EventInscription } from './eventInscription';
import { GroupMember } from './groupMember';

// Initialize Sequelize connection
export const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://five_user:five_password@localhost:5432/five',
  {
    dialect: 'postgres',
    logging: false,
  }
);

// Initialize models
export const UserModel = User.initModel(sequelize);
export const GroupModel = Group.initModel(sequelize);
export const EventModel = Event.initModel(sequelize);
export const EventInscriptionModel = EventInscription.initModel(sequelize);
export const GroupMemberModel = GroupMember.initModel(sequelize);

// Set up associations
UserModel.associate = ({ GroupModel, EventModel, EventInscriptionModel }) => {
  UserModel.hasMany(GroupModel, { foreignKey: 'ownerId', as: 'ownedGroups' });
  UserModel.belongsToMany(GroupModel, {
    through: 'group_members',
    foreignKey: 'userId',
    otherKey: 'groupId',
    as: 'groups'
  });
  UserModel.hasMany(EventModel, { foreignKey: 'organizerId', as: 'organizedEvents' });
  UserModel.hasMany(EventInscriptionModel, { foreignKey: 'userId', as: 'eventInscriptions' });
  UserModel.belongsToMany(EventModel, {
    through: EventInscriptionModel,
    foreignKey: 'userId',
    otherKey: 'eventId',
    as: 'events'
  });
};

GroupModel.associate = ({ UserModel, EventModel }) => {
  GroupModel.belongsTo(UserModel, { foreignKey: 'ownerId', as: 'owner' });
  GroupModel.belongsToMany(UserModel, {
    through: 'group_members',
    foreignKey: 'groupId',
    otherKey: 'userId',
    as: 'members'
  });
  GroupModel.hasMany(EventModel, { foreignKey: 'groupId', as: 'events' });
};

EventModel.associate = ({ UserModel, GroupModel, EventInscriptionModel }) => {
  EventModel.belongsTo(UserModel, { foreignKey: 'organizerId', as: 'organizer' });
  EventModel.belongsTo(GroupModel, { foreignKey: 'groupId', as: 'group' });
  EventModel.hasMany(EventInscriptionModel, { foreignKey: 'eventId', as: 'inscriptions' });
  EventModel.belongsToMany(UserModel, {
    through: EventInscriptionModel,
    foreignKey: 'eventId',
    otherKey: 'userId',
    as: 'participants'
  });
};

EventInscriptionModel.associate = ({ EventModel, UserModel }) => {
  EventInscriptionModel.belongsTo(EventModel, { foreignKey: 'eventId', as: 'event' });
  EventInscriptionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
};

GroupMemberModel.associate = ({ GroupModel, UserModel }) => {
  GroupMemberModel.belongsTo(GroupModel, { foreignKey: 'groupId', as: 'group' });
  GroupMemberModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
};

// Call associate methods after all models are defined
UserModel.associate({ GroupModel: GroupModel, EventModel: EventModel, EventInscriptionModel: EventInscriptionModel });
GroupModel.associate({ UserModel: UserModel, EventModel: EventModel });
EventModel.associate({ UserModel: UserModel, GroupModel: GroupModel, EventInscriptionModel: EventInscriptionModel });
EventInscriptionModel.associate({ EventModel: EventModel, UserModel: UserModel });
GroupMemberModel.associate({ GroupModel: GroupModel, UserModel: UserModel });

export { sequelize as default };