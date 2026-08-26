import { Sequelize, DataTypes, Model } from 'sequelize';
import { env } from '../config/env';
import { User } from './user';
import { Group } from './group';
import { Event } from './event';
import { EventInscription } from './eventInscription';
import { GroupMember } from './groupMember';
import { GroupInvitation } from './groupInvitation';
import { GroupMessage } from './groupMessage';
import { GroupMessageRead } from './groupMessageRead';
import { UserBlock } from './userBlock';
import { Report } from './report';
import { BugReport } from './bugReport';
import { Notification } from './notification';
import { NotificationPreference } from './notificationPreference';
import { EventReminder } from './eventReminder';
import { AuditLog } from './auditLog';
import { Venue } from './venue';
import { PushToken } from './pushToken';

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
export const GroupMessageModel = GroupMessage.initModel(sequelize);
export const GroupMessageReadModel = GroupMessageRead.initModel(sequelize);
export const UserBlockModel = UserBlock.initModel(sequelize);
export const ReportModel = Report.initModel(sequelize);
export const BugReportModel = BugReport.initModel(sequelize);
export const NotificationModel = Notification.initModel(sequelize);
export const NotificationPreferenceModel = NotificationPreference.initModel(sequelize);
export const EventReminderModel = EventReminder.initModel(sequelize);
export const AuditLogModel = AuditLog.initModel(sequelize);
export const VenueModel = Venue.initModel(sequelize);
export const PushTokenModel = PushToken.initModel(sequelize);

// Set up associations
User.associate = ({ Group, Event, EventInscription, GroupMember }) => {
  User.hasMany(Group, { foreignKey: 'ownerId', as: 'ownedGroups' });
  // `through` doit recevoir le MODELE, pas le nom de table : une chaine fait
  // fabriquer a Sequelize un modele intermediaire anonyme qui herite de
  // timestamps: true et reclame created_at/updated_at, colonnes absentes de
  // group_members (qui n'a qu'un joined_at).
  User.belongsToMany(Group, {
    through: GroupMember,
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

Group.associate = ({ User, Event, GroupMember }) => {
  Group.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
  Group.belongsToMany(User, {
    through: GroupMember,
    foreignKey: 'groupId',
    otherKey: 'userId',
    as: 'members'
  });
  Group.hasMany(Event, { foreignKey: 'groupId', as: 'events' });
};

Event.associate = ({ User, Group, EventInscription, Venue }) => {
  Event.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });
  Event.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
  Event.belongsTo(Venue, { foreignKey: 'venueId', as: 'venue' });
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

// Volontairement pas de Group.hasMany(GroupMessage) : rien n'en a besoin, et
// Group.associate porte encore le `through` fragile documente plus haut.

// Call associate methods after all models are defined
User.associate({ Group: GroupModel, Event: EventModel, EventInscription: EventInscriptionModel, GroupMember: GroupMemberModel });
Group.associate({ User: UserModel, Event: EventModel, GroupMember: GroupMemberModel });
Event.associate({ User: UserModel, Group: GroupModel, EventInscription: EventInscriptionModel, Venue: VenueModel });
EventInscription.associate({ Event: EventModel, User: UserModel });
GroupMember.associate({ Group: GroupModel, User: UserModel });
GroupInvitation.associate({ Group: GroupModel, User: UserModel });
GroupMessage.associate({ GroupModel, UserModel });
GroupMessageRead.associate({ GroupModel, UserModel });
UserBlock.associate({ UserModel });
Report.associate({ UserModel });
BugReport.associate({ UserModel });
Notification.associate({ UserModel });
NotificationPreference.associate({ UserModel });
EventReminder.associate({ EventModel, UserModel });
AuditLog.associate({ UserModel });
Venue.associate({ EventModel });
PushToken.associate({ UserModel });

export { sequelize as default };