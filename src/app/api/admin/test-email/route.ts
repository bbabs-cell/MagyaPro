import { ok, route } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/auth/session';
import { mailer } from '@/lib/mail';
import { mailStatus } from '@/lib/mail/status';
import { redactSecrets } from '@/lib/payments/failure';
import { env } from '@/lib/env';

/**
 * Envoi d'un email de test au Super Admin connecté.
 *
 * Le seul moyen de savoir si les emails partent vraiment est d'en envoyer un.
 * L'état affiché à côté ne dit que si la configuration *semble* complète : une
 * clé d'API présente mais révoquée, un domaine d'expédition non vérifié ou un
 * mot de passe SMTP périmé passent tous ce contrôle et échouent à l'envoi.
 *
 * Deux choix délibérés :
 *
 * 1. Le destinataire est l'adresse du compte connecté, jamais une adresse
 *    fournie dans la requête — sinon cette route deviendrait un relais
 *    d'envoi anonyme pour quiconque obtiendrait un accès administrateur.
 * 2. On appelle `mailer()` directement et non `sendMail()`, qui avale les
 *    erreurs volontairement (une inscription ne doit pas échouer parce que le
 *    serveur d'emails est indisponible). Ici, au contraire, l'erreur EST le
 *    résultat attendu : elle est renvoyée telle quelle.
 */
export const POST = route(async () => {
  const admin = await requireSuperAdmin();
  const status = mailStatus();

  if (!status.delivers) {
    return ok({
      sent: false,
      message: `Envoi impossible : ${status.message}`,
    });
  }

  try {
    await mailer().send({
      to: admin.email,
      subject: 'Test d’envoi — MagyaPro',
      text: [
        'Cet email confirme que MagyaPro parvient à envoyer des messages.',
        '',
        `Pilote utilisé : ${status.driver}`,
        `Expéditeur : ${env.mailFrom}`,
        '',
        'Aucune action n’est attendue de votre part.',
      ].join('\n'),
    });

    return ok({
      sent: true,
      message: `Email envoyé à ${admin.email}. S’il n’arrive pas dans les minutes qui viennent, vérifiez les indésirables puis la vérification du domaine d’expédition.`,
    });
  } catch (error) {
    return ok({
      sent: false,
      // Le message du fournisseur est le plus utile ici — c'est lui qui dit
      // « domaine non vérifié » ou « identifiants refusés ». Il est renvoyé
      // masqué : ce texte est écrit par un service tiers, et une erreur SMTP
      // ou HTTP y recopie volontiers l'identifiant employé. Le Super Admin
      // connaît déjà cette configuration, mais un diagnostic n'a aucune raison
      // de la réafficher.
      message: `Échec de l’envoi : ${redactSecrets(error instanceof Error ? error.message : 'erreur inconnue')}`,
    });
  }
});
