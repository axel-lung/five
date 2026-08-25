import Joi from 'joi';

// Registration validation schema
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  city: Joi.string().max(100).optional(),
  // C-01 : consentements separes. Les CGU sont obligatoires — d'ou
  // `valid(true)`, qui refuse un `false` explicite autant qu'une absence. Le
  // marketing reste facultatif : l'accepter ne doit jamais etre la condition
  // de la creation de compte.
  acceptTos: Joi.boolean().valid(true).required(),
  acceptMarketing: Joi.boolean().default(false),
});

// Login validation schema
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Update profile validation schema
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  avatarUrl: Joi.string().uri().optional(),
  bio: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  preferredPosition: Joi.string().max(50).optional(),
  selfDeclaredLevel: Joi.number().min(1).max(5).optional(),
  // C-03 : disponibilites. Les creneaux sont des etiquettes libres cote V1,
  // le client propose la liste ; le rayon est en kilometres.
  preferredSlots: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  travelRadiusKm: Joi.number().integer().min(0).max(200).allow(null).optional(),
});

// Create group validation schema
export const createGroupSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional(),
  city: Joi.string().max(100).optional(),
  avatarUrl: Joi.string().uri().optional(),
  accessType: Joi.string().valid('private', 'public').default('private'),
});

// Create event validation schema
export const createEventSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().max(1000).optional(),
  dateTime: Joi.date().iso().required(),
  location: Joi.string().max(255).optional(),
  capacity: Joi.number().integer().min(1).max(50).required(),
  level: Joi.string().max(50).optional(),
  price: Joi.number().precision(2).min(0).optional(),
  groupId: Joi.string().uuid().optional(),
  // PA-03 : rattachement a un complexe. Optionnel — tous les five ne se
  // jouent pas dans un complexe reference.
  venueId: Joi.string().uuid().allow(null).optional(),
});

// E-02 : transitions de statut pilotees par l'organisateur.
// 'full' est calcule par le serveur a partir de la capacite, jamais impose.
export const updateEventStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'open', 'completed', 'cancelled').required(),
});

// G-02 : creation d'un lien d'invitation.
export const createInvitationSchema = Joi.object({
  role: Joi.string().valid('admin', 'member').default('member'),
  expiresInDays: Joi.number().integer().min(1).max(90).default(7),
  // Absent = illimite jusqu'a expiration.
  maxUses: Joi.number().integer().min(1).max(500).optional(),
});

// Le middleware de validation vit dans middleware/validateRequest.ts.
// Il en existait une seconde copie ici, chaque fichier important l'une ou
// l'autre au hasard.
// S-05 : signalement d'un compte, d'un groupe ou d'un evenement.
export const createReportSchema = Joi.object({
  targetType: Joi.string().valid('user', 'group', 'event').required(),
  targetId: Joi.string().uuid().required(),
  reason: Joi.string().max(100).required(),
  details: Joi.string().max(1000).optional(),
});

// N-04 : preferences de notification. quietHours* acceptent null, qui
// signifie « pas d'heures de silence » et se distingue d'un champ absent.
export const updateNotificationPreferencesSchema = Joi.object({
  pushEnabled: Joi.boolean().optional(),
  emailEnabled: Joi.boolean().optional(),
  quietHoursStart: Joi.number().integer().min(0).max(23).allow(null).optional(),
  quietHoursEnd: Joi.number().integer().min(0).max(23).allow(null).optional(),
});

// G-03 : changement de role. 'owner' est absent a dessein — il s'obtient par
// transferOwnership, qui deplace aussi groups.owner_id.
export const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'member').required(),
});

export const transferOwnershipSchema = Joi.object({
  newOwnerId: Joi.string().uuid().required(),
});

// E-02 / E-03 : l'organisateur qui quitte sa session doit la leguer. Le champ
// est optionnel ici : sans lui, leaveEvent repond par un refus qui indique au
// client s'il faut demander un successeur ou proposer la suppression.
export const leaveEventSchema = Joi.object({
  newOrganizerId: Joi.string().uuid().optional(),
});

export const transferEventOwnershipSchema = Joi.object({
  newOrganizerId: Joi.string().uuid().required(),
});

// B-02 : moderation.
export const suspendUserSchema = Joi.object({
  reason: Joi.string().max(255).required(),
});

export const updateReportSchema = Joi.object({
  status: Joi.string().valid('open', 'reviewing', 'resolved', 'dismissed').required(),
  resolutionNote: Joi.string().max(1000).optional(),
});

// PA-03 : catalogue des complexes, alimente par le back-office.
export const createVenueSchema = Joi.object({
  name: Joi.string().max(255).required(),
  address: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  isPartner: Joi.boolean().default(false),
});

// E-04 : duplication d'un evenement recurrent. La date est obligatoire :
// dupliquer sans la deplacer creerait un doublon a la meme heure.
export const duplicateEventSchema = Joi.object({
  dateTime: Joi.date().iso().required(),
});

// Beta : declaration d'anomalie.
//
// `context` est rempli par le client, pas par le testeur : il est donc borne
// a des cles connues et a des longueurs strictes. `unknown(false)` (le
// defaut de Joi) refuse toute cle en trop, pour qu'un client bavard ne
// puisse pas stocker n'importe quoi dans le JSONB.
export const createBugReportSchema = Joi.object({
  kind: Joi.string().valid('bug', 'display', 'suggestion').default('bug'),
  severity: Joi.string().valid('blocking', 'major', 'minor').default('major'),
  description: Joi.string().trim().min(10).max(2000).required(),
  context: Joi.object({
    url: Joi.string().max(500).optional(),
    userAgent: Joi.string().max(500).optional(),
    viewport: Joi.string().max(20).optional(),
  }).default({}),
});

export const updateBugReportSchema = Joi.object({
  status: Joi.string().valid('open', 'investigating', 'fixed', 'dismissed').required(),
  resolutionNote: Joi.string().max(1000).optional(),
});

// S-01 : chat de groupe.
//
// 2000 caracteres : assez pour un vrai message, assez peu pour que la ligne
// et la trame WebSocket restent bon marche.
export const sendGroupMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  // Rend le renvoi idempotent : le client rejoue le meme nonce apres une
  // coupure, et le serveur renvoie le message deja enregistre au lieu d'en
  // creer un second.
  clientNonce: Joi.string().uuid().optional(),
});

// Deux modes de lecture exclusifs : la pagination vers le passe (`before`),
// et le rattrapage apres reconnexion (`since`). Les melanger n'aurait pas de
// sens, d'ou `oxor` ; et un curseur keyset sans son departage sauterait des
// lignes, d'ou `and`.
export const listGroupMessagesSchema = Joi.object({
  before: Joi.date().iso(),
  beforeId: Joi.string().uuid(),
  since: Joi.date().iso(),
  limit: Joi.number().integer().min(1).max(100).default(30),
})
  .oxor('before', 'since')
  .and('before', 'beforeId');

// `upTo` optionnel : sans lui, on marque lu jusqu'a maintenant.
export const markChatReadSchema = Joi.object({
  upTo: Joi.date().iso().optional(),
});
