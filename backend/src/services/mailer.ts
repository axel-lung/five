import { env } from '../config/env';

/**
 * Transport d'emails transactionnels (N-02).
 *
 * La V1 ne branche aucun fournisseur : seule l'interface et une
 * implementation console existent. Resend viendra s'y substituer sans que les
 * controleurs changent — ils ne connaissent que `mailer.send()`.
 */
export interface Mail {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Ecrit le mail dans les logs. Silencieux en test pour ne pas noyer jest. */
export const consoleMailer: Mailer = {
  async send(mail: Mail): Promise<void> {
    if (env.nodeEnv === 'test') return;
    console.log(`[mailer] a=${mail.to} sujet="${mail.subject}"\n${mail.body}`);
  },
};

export const mailer: Mailer = consoleMailer;
