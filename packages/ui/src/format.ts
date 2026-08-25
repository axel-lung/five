/** Format long en francais, utilise partout ou une date s'affiche. */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
