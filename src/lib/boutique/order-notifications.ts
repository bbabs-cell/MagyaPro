import { sendMail } from '@/lib/mail';
import { sendSms } from '@/lib/sms';
import { formatMoney } from '@/lib/money';

/**
 * Avertit le client d'une commande en ligne par SMS et email (si renseigné)
 * — sans quoi il n'a aucun moyen de savoir que sa commande a avancé sans
 * revenir consulter la page de suivi. Échec silencieux comme les autres
 * envois de la plateforme (`sendMail`/`sendSms`) : jamais bloquant pour le
 * traitement de la commande elle-même.
 */

const MESSAGES: Record<string, (storeName: string, number: number) => string> = {
  CREATED: (storeName, number) =>
    `${storeName} : votre commande n°${number} a bien été reçue. Vous serez averti(e) quand elle sera prête pour retrait.`,
  CONFIRMED: (storeName, number) => `${storeName} : votre commande n°${number} est confirmée.`,
  READY: (storeName, number) =>
    `${storeName} : votre commande n°${number} est prête pour retrait !`,
  CANCELLED: (storeName, number) =>
    `${storeName} : votre commande n°${number} a été annulée. Contactez la boutique pour en savoir plus.`,
};

export async function notifyCustomerOrderEvent(
  event: keyof typeof MESSAGES,
  order: {
    number: number;
    total: number;
    currency: string;
    customerPhone: string;
    customerEmail: string | null;
  },
  storeName: string,
): Promise<void> {
  const text = MESSAGES[event](storeName, order.number);

  await sendSms(order.customerPhone, text);

  if (order.customerEmail) {
    await sendMail({
      to: order.customerEmail,
      subject: `${storeName} — commande n°${order.number}`,
      text: `${text}\n\nMontant : ${formatMoney(order.total, order.currency)}.`,
    });
  }
}
