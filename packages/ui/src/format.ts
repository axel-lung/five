/** Format long en francais, utilise partout ou une date s'affiche. */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Lit une date saisie a la main, en heure locale.
 *
 * `new Date('2026-08-27 19:30')` n'est PAS specifie par ECMAScript : la forme
 * a espace, sans fuseau, est laissee a la discretion du moteur. V8 l'accepte,
 * Hermes est plus strict — et une date invalide fait lever `toISOString()`,
 * donc planter l'ecran au lieu d'afficher une erreur.
 *
 * On construit donc la date a partir de ses composants, ce qui la rend
 * independante du moteur et sans ambiguite sur le fuseau : les nombres passes
 * au constructeur sont toujours interpretes en heure locale, celle du joueur.
 *
 * Renvoie `null` sur une saisie illisible, pour que l'appelant le dise.
 */
export const parseLocalDateTime = (input: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  const date = new Date(year, month - 1, day, hour, minute);

  // Rejette les dates qui « debordent », comme le 31 fevrier : le
  // constructeur les reporte silencieusement au mois suivant.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
};

/** Remplit un champ de saisie a partir d'une date ISO, en heure locale. */
export const toLocalInput = (value: string | Date): string => {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};
