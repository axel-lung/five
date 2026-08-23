import { Sequelize, DataTypes, Model } from 'sequelize';
import dotenv from 'dotenv';
import { User } from './user';
import { Group } from './group';
import { Event } from './event';
import { EventInscription } from './eventInscription';
import { GroupMember } from './groupMember';

// Les imports ES sont hisses : ce module s'execute avant le dotenv.config()
// de server.ts. On recharge donc .env ici (l'appel est idempotent), sinon
// DATABASE_URL serait absent en developpement local.
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL est requis. Voir .env.example ; en Docker il est fourni par docker-compose.yml.'
  );
}

// Initialize Sequelize connection
export const sequelize = new Sequelize(databaseUrl, {
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

// Call associate methods after all models are defined
User.associate({ Group: GroupModel, Event: EventModel, EventInscription: EventInscriptionModel });
Group.associate({ User: UserModel, Event: EventModel });
Event.associate({ User: UserModel, Group: GroupModel, EventInscription: EventInscriptionModel });
EventInscription.associate({ Event: EventModel, User: UserModel });
GroupMember.associate({ Group: GroupModel, User: UserModel });

export { sequelize as default };