import nodemailer from 'nodemailer';

import { env } from '@/lib/env';

/**
 * Envoi d'emails transactionnels.
 *
 * L'application appelle `sendMail()` ; le pilote décide de l'acheminement.
 * En développement, `console` écrit le message dans les logs serveur — un
 * lien de réinitialisation reste ainsi accessible sans configurer un SMTP,
 * et sans faire croire qu'un email a réellement été expédié.
 *
 * En production, `smtp` envoie réellement le message via le serveur SMTP
 * configuré (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`). `resend`
 * envoie via l'API HTTP de Resend (`RESEND_API_KEY`) — seul chemin qui
 * fonctionne sur un runtime sans sockets TCP bruts, comme Cloudflare Workers,
 * où le pilote `smtp` (nodemailer, connexions TCP directes) n'est pas fiable.
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

/** Adresse d'expédition, sans le nom d'affichage (nodemailer exige `to` sans display-name côté enveloppe). */
function parseFromAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1]! : from;
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpTransport() {
  if (cachedTransport) return cachedTransport;
  if (!env.smtpHost || !env.smtpUser || !env.smtpPassword) {
    throw new Error(
      'Pilote SMTP demandé mais SMTP_HOST/SMTP_USER/SMTP_PASSWORD manquants. Voir .env.example.',
    );
  }
  cachedTransport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
  });
  return cachedTransport;
}

const smtpDriver: MailDriver = {
  name: 'smtp',
  async send(message) {
    await smtpTransport().sendMail({
      from: env.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      envelope: { from: parseFromAddress(env.mailFrom), to: message.to },
    });
  },
};

const resendDriver: MailDriver = {
  name: 'resend',
  async send(message) {
    if (!env.resendApiKey) {
      throw new Error('Pilote Resend demandé mais RESEND_API_KEY manquant. Voir .env.example.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Resend a refusé l'envoi (${response.status}) : ${body.slice(0, 300)}`);
    }
  },
};

const drivers: Record<string, MailDriver> = {
  console: consoleDriver,
  smtp: smtpDriver,
  resend: resendDriver,
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
    subject: 'Confirmez votre adresse email — Magyapro',
    text: [
      `Bonjour ${name},`,
      '',
      'Bienvenue sur Magyapro. Confirmez votre adresse email pour activer votre compte :',
      link,
      '',
      "Ce lien expire dans 48 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.",
      '',
      "L'équipe Magyapro",
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
    subject: 'Réinitialisation de votre mot de passe — Magyapro',
    text: [
      `Bonjour ${name},`,
      '',
      'Vous avez demandé la réinitialisation de votre mot de passe :',
      link,
      '',
      "Ce lien expire dans 60 minutes et ne peut servir qu'une fois.",
      "Si vous n'êtes pas à l'origine de cette demande, aucune action n'est nécessaire : votre mot de passe reste inchangé.",
      '',
      "L'équipe Magyapro",
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
