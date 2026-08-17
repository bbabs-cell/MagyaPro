import { env } from '@/lib/env';

/**
 * SMS transactionnels via Africa's Talking — choisi pour sa couverture et
 * ses tarifs en Afrique de l'Ouest, cohérent avec le reste de la
 * plateforme (Wave, Orange Money).
 *
 * Best-effort, comme l'email : un échec d'envoi ne doit jamais faire
 * échouer l'action métier qui le déclenche (une commande reste valide même
 * si le SMS de confirmation n'est pas parti).
 */
const LIVE_URL = 'https://api.africastalking.com/version1/messaging';
const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

export async function sendSms(to: string, message: string): Promise<void> {
  if (!env.africastalkingApiKey || !env.africastalkingUsername) return;

  const url = env.africastalkingUsername === 'sandbox' ? SANDBOX_URL : LIVE_URL;
  const body = new URLSearchParams({
    username: env.africastalkingUsername,
    to,
    message,
    ...(env.africastalkingSenderId ? { from: env.africastalkingSenderId } : {}),
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apiKey: env.africastalkingApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    if (!response.ok) {
      console.error("[sms] Échec envoi Africa's Talking :", response.status, await response.text());
    }
  } catch (error) {
    console.error('[sms] Erreur réseau :', error);
  }
}
