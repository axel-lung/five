/**
 * C-04 : profil minimal expose aux autres membres.
 *
 * `exclude: ['passwordHash']` etait insuffisant — il laissait passer email et
 * telephone. On liste donc explicitement ce qui est partageable plutot que
 * d'enumerer ce qui ne l'est pas : un champ ajoute plus tard reste prive
 * par defaut.
 *
 * Cette liste est partagee par tous les controleurs : groupes ET evenements.
 * Elle vivait auparavant dans groupController, et le nettoyage n'avait jamais
 * ete reporte cote evenements, qui exposaient donc encore email et telephone.
 */
export const PUBLIC_USER_ATTRIBUTES = [
  'id',
  'firstName',
  'lastName',
  'avatarUrl',
  'city',
  'preferredPosition',
  'selfDeclaredLevel',
];
