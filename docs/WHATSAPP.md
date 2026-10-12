# Reçus et relances par WhatsApp

« Qui me doit de l'argent » avait sa réponse à l'écran, pas son geste suivant.
Et un client qui voulait son reçu repartait sans, ou avec une photo de l'écran.

Deux envois, tous deux par un simple lien `wa.me` : gratuits, sans compte
WhatsApp Business ni fournisseur. C'est le commerçant qui envoie, depuis son
propre numéro — celui que ses clients connaissent déjà.

## Où

| Écran | Geste | Message |
|---|---|---|
| Caisse, après chaque vente | « Envoyer le reçu à Awa » (ou « par WhatsApp » sans client choisi) | le reçu : lignes, total, reste à payer s'il y en a |
| Ventes, chaque vente non annulée | « Reçu » | le reçu de cette vente |
| Clients, chaque client qui doit de l'argent | « Relancer » | un rappel du solde, sur un ton amical |

« Relancer » n'apparaît qu'à qui peut aussi encaisser un remboursement
(`credits:manage`) : c'est le même métier.

## Le reçu est du texte, pas un lien

Le reçu en ligne de MagyaPro (`/boutique/recu/…`) est réservé à l'équipe de la
boutique : un client qui l'ouvrirait tomberait sur une page de connexion. Le
message contient donc le reçu lui-même, lisible sans réseau une fois reçu.

Il est rédigé dans la caisse au moment où la vente est enregistrée — c'est le
seul instant où ses lignes existent encore côté caisse —, avec le total retenu
par le serveur.

## Les numéros

Les clients sont souvent enregistrés sans indicatif (« 77 30 30 30 »).
Envoyé tel quel à `wa.me`, un tel numéro ouvrirait la conversation d'un
inconnu. La règle (`whatsAppNumber`, `src/lib/whatsapp.ts`) :

- un numéro avec `+` ou `00` est déjà international : gardé tel quel ;
- un numéro local reçoit l'indicatif du **pays de la boutique**, reconnu dans
  sa saisie libre (« Sénégal », « Cote d'Ivoire », « CI »…) ;
- le zéro de tête est conservé : en Côte d'Ivoire il fait partie du numéro ;
- sans pays reconnu, **on ne devine pas** : WhatsApp s'ouvre sur le choix du
  contact, message déjà rédigé.

Pays couverts : les huit de l'UEMOA, la Guinée, la Mauritanie, et les pays
de la CEMAC.

Un pays mal renseigné dans les réglages de la boutique donne donc un lien
vers le choix du contact, jamais vers un mauvais numéro.

## Vérifié

- 8 tests sur la normalisation et la rédaction des messages.
- Parcours réel en caisse : vente encaissée à crédit pour un client au numéro
  local, bouton « Envoyer le reçu à Moussa », lien `wa.me/221…` avec le reçu
  et le reste à payer.
- Liens « Relancer » et « Reçu » lus sur les pages Clients et Ventes.
