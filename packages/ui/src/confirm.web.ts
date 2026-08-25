import type { ConfirmOptions } from './confirm';

/**
 * Sur le web on garde la boite native du navigateur : c'est ce que les
 * utilisateurs actuels connaissent, et elle bloque le fil comme avant.
 */
export async function confirmAsync(
  message: string,
  _options?: ConfirmOptions
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return window.confirm(message);
}
