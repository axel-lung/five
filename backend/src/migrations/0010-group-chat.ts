import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * S-01 : chat instantane de groupe.
 *
 * Aucune table `conversations` : le chat n'est pas une entite qu'on cree, il
 * est implicite et clef par `group_id`. Consequence voulue — tout groupe
 * existant a son chat des l'application de cette migration, sans reprise de
 * donnees ni risque de groupe orphelin de conversation.
 *
 * Le temps reel (WebSocket) ne fait que pousser : ces tables restent la
 * source de verite, et c'est par elles que passe la reconciliation apres une
 * coupure reseau (voir src/ws/index.ts).
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('group_messages', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'groups', key: 'id' },
      // Contrairement aux FK vers `users`, ce CASCADE se declenche vraiment :
      // la suppression d'un groupe est un destroy() reel (groupController).
      onDelete: 'CASCADE',
    },
    author_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      // Comme partout ailleurs : la suppression de compte est une
      // anonymisation (voir 0003), ce CASCADE ne se declenche donc jamais.
      // Les messages survivent et s'affichent « Compte supprime ».
      onDelete: 'CASCADE',
    },
    // Nullable : un message ne portant qu'une image est legitime.
    body: { type: DataTypes.TEXT, allowNull: true },
    // Chemin opaque `/api/media/<cle>`, meme forme que users.avatar_url. Une
    // table d'attachements coutait une jointure sur le chemin de lecture le
    // plus chaud de l'app, pour une seule image par message (multer plafonne
    // deja a files: 1).
    image_url: { type: DataTypes.TEXT, allowNull: true },
    // Rend l'envoi idempotent : sans lui, rejouer un POST apres une coupure
    // reseau duplique le message — sur mobile, c'est hebdomadaire. Sert aussi
    // a resoudre l'echo optimiste cote client.
    client_nonce: { type: DataTypes.UUID, allowNull: true },
    // Pierre tombale plutot que suppression dure. La raison n'est pas la
    // moderation mais la reconciliation : un client qui a rate la trame
    // « message supprime » demande le delta depuis sa derniere date connue,
    // et un delta sait signaler l'apparition d'une ligne, jamais une absence.
    // La ligne tombale EST le delta.
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    deleted_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Joi n'est pas la derniere ligne de defense. La branche `deleted_at` est
  // indispensable : effacer le contenu fait partie de la suppression (une
  // tombale qui garde le texte n'est pas une suppression, et un export RGPD
  // le contiendrait encore), et sans cette exemption la contrainte
  // interdirait la suppression elle-meme.
  await q.sequelize.query(`
    ALTER TABLE "group_messages"
    ADD CONSTRAINT "group_messages_content_present"
    CHECK (
      "deleted_at" IS NOT NULL
      OR ("body" IS NOT NULL AND btrim("body") <> '')
      OR "image_url" IS NOT NULL
    );
  `);

  // L'index qui porte la fonctionnalite. Il sert « les N derniers messages
  // d'un groupe » en simple parcours de plage, et c'est exactement le
  // predicat du curseur keyset : (created_at, id) < (:before, :beforeId).
  //
  // Le departage par `id` n'est pas cosmetique : DataTypes.DATE est pose
  // depuis l'horloge JS, tronque a la milliseconde. Deux messages d'une meme
  // rafale peuvent reellement partager un created_at, et une pagination sans
  // departage sauterait alors une ligne.
  //
  // Pas de DESC : Postgres parcourt un btree dans les deux sens, et on lit
  // dans les deux — decroissant pour l'historique, croissant pour le delta.
  await q.addIndex('group_messages', ['group_id', 'created_at', 'id'], {
    name: 'group_messages_group_id_created_at_id_idx',
  });

  // Partiel, donc minuscule : les suppressions sont rares. Il sert la seconde
  // branche du delta de reconnexion (`deleted_at > :since`), qui sans lui
  // balaierait tout l'historique du groupe a chaque reconnexion.
  await q.sequelize.query(`
    CREATE INDEX "group_messages_group_id_deleted_at_idx"
    ON "group_messages" ("group_id", "deleted_at")
    WHERE "deleted_at" IS NOT NULL;
  `);

  // Unique partiel : c'est lui qui rend le renvoi idempotent. Partiel parce
  // que client_nonce est nul pour tout message qui n'en fournit pas, et que
  // NULL n'entre pas dans un index partiel — sans le WHERE, l'unicite serait
  // certes respectee (NULL != NULL) mais l'index porterait toutes les lignes.
  await q.sequelize.query(`
    CREATE UNIQUE INDEX "group_messages_author_id_client_nonce_uniq"
    ON "group_messages" ("author_id", "client_nonce")
    WHERE "client_nonce" IS NOT NULL;
  `);

  /**
   * Filigrane de lecture, un par membre et par groupe.
   *
   * Clef primaire composite et pas d'`id` de substitution — meme choix que
   * notification_preferences. Le decompte devient une recherche indexee et
   * l'upsert est naturellement idempotent.
   *
   * Un horodatage et non un `last_read_message_id` : le decompte compare sur
   * created_at, c'est donc la colonne dont il a besoin, et elle emprunte
   * l'index ci-dessus. Un identifiant de message imposerait une jointure pour
   * retrouver sa date.
   */
  await q.createTable('group_message_reads', {
    group_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    last_read_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
};

export const down = async ({ context: q }: MigrationParams) => {
  // dropTable emporte index et contraintes de la table.
  await q.dropTable('group_message_reads');
  await q.dropTable('group_messages');
};
