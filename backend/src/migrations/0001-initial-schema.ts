import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * Schema initial V1 : comptes, groupes, evenements, inscriptions.
 *
 * Les identifiants UUID sont generes cote application (DataTypes.UUIDV4 dans
 * les modeles), pas par Postgres : aucune extension uuid-ossp n'est requise.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('users', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    first_name: { type: DataTypes.STRING(100), allowNull: true },
    last_name: { type: DataTypes.STRING(100), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    avatar_url: { type: DataTypes.TEXT, allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    preferred_position: { type: DataTypes.STRING(50), allowNull: true },
    self_declared_level: { type: DataTypes.INTEGER, allowNull: true },
    email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    phone_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.createTable('groups', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    avatar_url: { type: DataTypes.TEXT, allowNull: true },
    access_type: {
      type: DataTypes.ENUM('private', 'public'),
      allowNull: false,
      defaultValue: 'private',
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.createTable('group_members', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    joined_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  });

  await q.createTable('events', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    date_time: { type: DataTypes.DATE, allowNull: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
    capacity: { type: DataTypes.INTEGER, allowNull: false },
    level: { type: DataTypes.STRING(50), allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'open', 'full', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    organizer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'groups', key: 'id' },
      onDelete: 'SET NULL',
    },
    shareable_link_token: { type: DataTypes.UUID, allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  });

  await q.createTable('event_inscriptions', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    event_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'waitlist', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    registered_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  });

  // Un joueur ne peut appartenir qu'une fois a un groupe, ni s'inscrire deux
  // fois au meme evenement. Contraintes absentes des modeles Sequelize :
  // c'est la base qui les garantit.
  await q.addConstraint('group_members', {
    fields: ['group_id', 'user_id'],
    type: 'unique',
    name: 'group_members_group_id_user_id_unique',
  });

  await q.addConstraint('event_inscriptions', {
    fields: ['event_id', 'user_id'],
    type: 'unique',
    name: 'event_inscriptions_event_id_user_id_unique',
  });

  // Index sur les acces les plus frequents des parcours V1.
  await q.addIndex('events', ['group_id'], { name: 'events_group_id_idx' });
  await q.addIndex('events', ['date_time'], { name: 'events_date_time_idx' });
  await q.addIndex('group_members', ['user_id'], { name: 'group_members_user_id_idx' });
  await q.addIndex('event_inscriptions', ['user_id'], {
    name: 'event_inscriptions_user_id_idx',
  });
};

export const down = async ({ context: q }: MigrationParams) => {
  // Ordre inverse des dependances de cles etrangeres.
  await q.dropTable('event_inscriptions');
  await q.dropTable('events');
  await q.dropTable('group_members');
  await q.dropTable('groups');
  await q.dropTable('users');

  // Postgres conserve les types ENUM apres suppression des tables.
  for (const enumType of [
    'enum_groups_access_type',
    'enum_group_members_role',
    'enum_events_status',
    'enum_event_inscriptions_status',
  ]) {
    await q.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
  }
};
