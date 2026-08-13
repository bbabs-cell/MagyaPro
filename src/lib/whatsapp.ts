/**
 * Liens WhatsApp « click-to-chat ».
 *
 * `wa.me` ne demande ni compte développeur ni clé d'API : c'est un simple
 * lien qui ouvre WhatsApp (application ou web) avec un message pré-rempli, que
 * l'expéditeur envoie lui-même d'un geste. C'est donc une notification
 * réellement fonctionnelle dès aujourd'hui — contrairement à un envoi
 * automatique par API, qui demanderait un compte WhatsApp Business payant que
 * la plateforme n'a pas encore.
 *
 * Module pur : aucune dépendance Node, utilisable aussi bien dans un
 * composant serveur que client.
 */

/** Ne garde que les chiffres, comme l'exige le format `wa.me/<numéro>`. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const number = digitsOnly(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Message de notification de changement de statut, prêt à l'envoi. */
export function orderStatusWhatsAppMessage(params: {
  restaurantName: string;
  customerName: string;
  orderNumber: number;
  statusLabel: string;
  trackingUrl: string;
}): string {
  return [
    `Bonjour ${params.customerName},`,
    `${params.restaurantName} — votre commande n°${params.orderNumber} est maintenant « ${params.statusLabel} ».`,
    `Suivez-la ici : ${params.trackingUrl}`,
  ].join('\n');
}
