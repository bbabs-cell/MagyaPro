# Renouvellement de l'abonnement Boutique (paiement manuel Wave / Orange Money)

Le paiement reste manuel. Le commerçant envoie le montant au numéro de la plateforme, puis dépose une
capture, et MagyaPro valide. Tout ce qui ralentissait ce circuit a été repris.

## Côté commerçant

- **Trois étapes numérotées**, avec un bouton « Copier » pour chaque valeur : le numéro, le montant exact
  et la **référence** du paiement. Un chiffre mal recopié, c'est un envoi au mauvais numéro.
- **Référence** `MP-XXXXXX` (`src/lib/boutique/subscription-reference.ts`) : elle se met dans le motif de
  l'envoi Wave ou Orange Money. Elle est dérivée de l'identifiant de la demande, sans rien stocker, et
  s'affiche aussi côté administration.
- La capture peut être **remplacée** tant que la demande attend sa validation.
- Une demande **sans capture peut être annulée** (mauvais plan, mauvais moyen de paiement). Avant, une
  demande oubliée bloquait toute nouvelle demande. Une demande avec capture ne s'annule pas : l'argent est
  peut-être déjà parti.
- **Validation et refus sont notifiés** : notification, push sur le téléphone et e-mail à la validation,
  avec la nouvelle échéance. Le commerçant n'a plus à revenir vérifier lui-même.

## Payer en avance ne fait perdre aucun jour

À la validation, la nouvelle période part de l'**échéance en cours** si l'abonnement court encore
(actif, essai ou délai de grâce), sinon d'aujourd'hui. Avant, elle repartait toujours d'aujourd'hui :
payer cinq jours en avance faisait perdre ces cinq jours.

## Rappels automatiques (tâche de nuit `/api/cron/verifier-abonnements`)

| Quand | À qui | Message |
|---|---|---|
| 5 jours avant l'échéance | commerçant | montant exact, « payer maintenant ne fait perdre aucun jour » |
| la veille de l'échéance | commerçant | dernier rappel |
| demande sans capture depuis 24 h | commerçant | « votre paiement n'est pas terminé », avec la référence |
| capture en attente depuis 24 h | MagyaPro (notification d'administration) | paiement à valider, avec la référence |

Les deux rappels d'échéance partagent la colonne `expiryAlertSentAt` : le second ne part que si le premier
date d'avant les dernières 36 heures. Les relances de paiement en chemin utilisent une fenêtre « entre 24
et 48 heures » que la tâche quotidienne ne traverse qu'une fois. Aucun rappel ne part si une capture
attend déjà sa validation.

**Aucune migration.** Tests : `tests/store-subscription-renewal.test.ts`.
