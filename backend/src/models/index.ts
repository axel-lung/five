import { Sequelize, DataTypes, Model } from 'sequelize';
import { env } from '../config/env';
import { User } from './user';
import { Group } from './group';
import { Event } from './event';
import { EventInscription } from './eventInscription';
import { GroupMember } from './groupMember';
import { GroupInvitation } from './groupInvitation';

// Initialize Sequelize connection
export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: {
    // Les attributs sont en camelCase cote TypeScript, les colonnes en
    // snake_case cote Postgres (convention SQL, evite les identifiants quotes).
    underscored: true,
  },
});

// Initialize models
export const UserModel = User.initModel(sequelize);
export const GroupModel = Group.initModel(sequelize);
export const EventModel = Event.initModel(sequelize);
export const EventInscriptionModel = EventInscription.initModel(sequelize);
export const GroupMemberModel = GroupMember.initModel(sequelize);
export const GroupInvitationModel = GroupInvitation.initModel(sequelize);

// Set up associations
User.associate = ({ Group, Event, EventInscription }) => {
  User.hasMany(Group, { foreignKey: 'ownerId', as: 'ownedGroups' });
  User.belongsToMany(Group, {
    through: 'group_members',
    foreignKey: 'userId',
    otherKey: 'groupId',
    as: 'groups'
  });
  User.hasMany(Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
  User.hasMany(EventInscription, { foreignKey: 'userId', as: 'eventInscriptions' });
  User.belongsToMany(Event, {
    through: EventInscription,
    foreignKey: 'userId',
    otherKey: 'eventId',
    as: 'events'
  });
};

Group.associate = ({ User, Event }) => {
  Group.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
  Group.belongsToMany(User, {
    through: 'group_members',
    foreignKey: 'groupId',
    otherKey: 'userId',
    as: 'members'
  });
  Group.hasMany(Event, { foreignKey: 'groupId', as: 'events' });
};

Event.associate = ({ User, Group, EventInscription }) => {
  Event.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });
  Event.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  Event.hasMany(EventInscription, { foreignKey: 'eventId', as: 'inscriptions' });
  Event.belongsToMany(User, {
    through: EventInscription,
    foreignKey: 'eventId',
    otherKey: 'userId',
    as: 'participants'
  });
};

EventInscription.associate = ({ Event, User }) => {
  EventInscription.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
  EventInscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

GroupMember.associate = ({ Group, User }) => {
  GroupMember.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

GroupInvitation.associate = ({ Group, User }) => {
  GroupInvitation.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  GroupInvitation.belongsTo(User, { foreignKey: 'createdBy', as: 'inviter' });
};

// Call associate methods after all models are defined
User.associate({ Group: GroupModel, Event: EventModel, EventInscription: EventInscriptionModel });
Group.associate({ User: UserModel, Event: EventModel });
Event.associate({ User: UserModel, Group: GroupModel, EventInscription: EventInscriptionModel });
EventInscription.associate({ Event: EventModel, User: UserModel });
GroupMember.associate({ Group: GroupModel, User: UserModel });
GroupInvitation.associate({ Group: GroupModel, User: UserModel });

export { sequelize as default };