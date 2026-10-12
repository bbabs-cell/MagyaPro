# Impression des tickets de caisse (Boutique)

Les tickets sont faits pour les imprimantes thermiques de 58 mm (petites imprimantes Bluetooth) et de 80 mm
(imprimantes de comptoir). Le réglage se fait **sur chaque appareil**, car chaque caisse a sa propre imprimante.
On le trouve sous la caisse (« Imprimante de tickets », replié) et dans Réglages.

## Deux façons d'imprimer

| | Bluetooth | Imprimante de l'appareil |
|---|---|---|
| Navigateur | Chrome (Android, ordinateur) | tous |
| Fenêtre d'impression | aucune | oui |
| Imprimantes | ESC/POS : Xprinter, Goojprt, Sunmi, Epson… | USB, Wi-Fi, AirPrint, application d'impression Android |
| Format | octets ESC/POS (`encodeEscPos`) | page `/boutique/ticket/[id]?largeur=58\|80` |

Les deux sorties ont le même contenu (`ticketRows` dans `src/lib/boutique/ticket.ts`) :
- en-tête (nom en double taille, adresse, téléphone, identifiant légal) ;
- numéro et date du ticket, client ;
- lignes « 2 cartons x 6 000 F CFA » avec le montant calé à droite ;
- sous-total, remise, TVA, **TOTAL** en gras ;
- règlements, reste à payer, remerciement.

## Où imprimer

- **Caisse.** Un bouton « Imprimer le ticket » apparaît après chaque vente. Avec « Imprimer le ticket à chaque
  vente », le ticket part tout seul. Il est construit à partir de la vente renvoyée par le serveur, sans
  second aller-retour.
- **Ventes.** Le bouton « Ticket » réimprime une vente passée, via `GET /api/boutique/sales/[id]/ticket`,
  avec la permission `sales:view`.
- **Réglages.** Un ticket d'essai vérifie la connexion et les accents.

## Détails

- **Accents.** Le ticket est encodé en page de code PC850 (`ESC t 2`), que connaissent presque toutes les
  imprimantes. Sinon, décochez « Imprimer les accents » : le ticket passe en ASCII (é → e).
- **Bluetooth.** Le ticket est envoyé par paquets de 180 octets espacés de 25 ms : le tampon des imprimantes
  bon marché perd la fin du ticket sinon. La liste des services déclarés couvre les modèles courants
  (`PRINTER_SERVICES`).
- **Reconnexion.** L'imprimante choisie est reprise sans rien demander tant que la page reste ouverte. Après
  un rechargement, Chrome la reprend s'il se souvient des appareils autorisés ; sinon il faut toucher
  « Connecter l'imprimante ».
- **Quantités.** Elles sont stockées en unité de base : une vente au carton s'imprime « 1 carton », pas
  « 24 bouteilles ».
- La découpe (`GS V`) est sans effet sur les imprimantes sans massicot.
- **Aucune migration.** Les réglages restent dans le navigateur (`magyapro:imprimante`).

Tests : `tests/ticket.test.ts` (largeur, alignement, PC850, octets ESC/POS, réimpression, isolation entre
boutiques).
