import { env } from '@/lib/env';

/**
 * Envoi d'emails transactionnels.
 *
 * L'application appelle `sendMail()` ; le pilote décide de l'acheminement.
 * En développement, `console` écrit le message dans les logs serveur — un
 * lien de réinitialisation reste ainsi accessible sans configurer un SMTP,
 * et sans faire croire qu'un email a réellement été expédié.
 *
 * Aucun pilote SMTP n'est fourni pour l'instant : le brancher demande une
 * dépendance d'envoi et des identifiants. Le point d'extension est prêt, il
 * n'est pas simulé.
 */

export type MailMessage = {
  to: string;
  subject: string;
  /** Corps en texte brut. Toujours renseigné, y compris avec `html`. */
  text: string;
  html?: string;
};

export interface MailDriver {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

const consoleDriver: MailDriver = {
  name: 'console',
  async send(message) {
    console.info(
      [
        '',
        '─────────── EMAIL (pilote « console ») ───────────',
        `De      : ${env.mailFrom}`,
        `À       : ${message.to}`,
        `Objet   : ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  },
};

const drivers: Record<string, MailDriver> = {
  console: consoleDriver,
};

export function mailer(): MailDriver {
  const driver = drivers[env.mailDriver];
  if (!driver) {
    console.warn(
      `[mail] Pilote « ${env.mailDriver} » non configuré, repli sur « console ».`,
    );
    return consoleDriver;
  }
  return driver;
}

/**
 * Envoie un email. Un échec est journalisé mais ne remonte pas : une
 * inscription ne doit pas échouer parce que le serveur SMTP est indisponible.
 * L'utilisateur peut toujours redemander l'email de vérification.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await mailer().send(message);
  } catch (error) {
    console.error("[mail] Échec de l'envoi :", error);
  }
}

// --- Modèles ---------------------------------------------------------------

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${env.appUrl}/verifier-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Confirmez votre adresse email — Magya',
    text: [
      `Bonjour ${name},`,
      '',
      'Bienvenue sur Magya. Confirmez votre adresse email pour activer votre compte :',
      link,
      '',
      "Ce lien expire dans 48 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.",
      '',
      "L'équipe Magya",
    ].join('\n'),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${env.appUrl}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Réinitialisation de votre mot de passe — Magya',
    text: [
      `Bonjour ${name},`,
      '',
      'Vous avez demandé la réinitialisation de votre mot de passe :',
      link,
      '',
      "Ce lien expire dans 60 minutes et ne peut servir qu'une fois.",
      "Si vous n'êtes pas à l'origine de cette demande, aucune action n'est nécessaire : votre mot de passe reste inchangé.",
      '',
      "L'équipe Magya",
    ].join('\n'),
  });
}

export async function sendNewOrderEmail(params: {
  to: string;
  restaurantName: string;
  orderNumber: number;
  total: string;
}): Promise<void> {
  await sendMail({
    to: params.to,
    subject: `Nouvelle commande n°${params.orderNumber} — ${params.restaurantName}`,
    text: [
      `Vous avez reçu une nouvelle commande n°${params.orderNumber}.`,
      `Montant : ${params.total}`,
      '',
      `Consultez-la dans votre tableau de bord : ${env.appUrl}/dashboard/commandes`,
    ].join('\n'),
  });
}
