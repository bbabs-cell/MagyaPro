/**
 * Référence courte d'une demande de paiement d'abonnement — « MP-7K2Q9X ».
 *
 * Le commerçant la recopie dans le motif de son envoi Wave ou Orange Money ;
 * le Super Admin la retrouve dans le SMS de réception. Sans elle, valider
 * revient à rapprocher des montants et des heures, ce qui ralentit chaque
 * validation et prête à confusion quand deux boutiques paient le même jour
 * le même montant.
 *
 * Dérivée de l'identifiant : rien à stocker, et la même partout.
 */
export function paymentReference(paymentId: string): string {
  return `MP-${paymentId.slice(-6).toUpperCase()}`;
}
