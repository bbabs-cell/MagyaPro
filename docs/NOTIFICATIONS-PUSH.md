# Notifications push

Une commande en ligne ne sonnait que si le tableau de bord était **ouvert à
l'écran**. Téléphone en veille, onglet fermé : rien. C'était la promesse
principale de MagyaPro Restaurant — « le client commande seul » — avec un trou
au milieu.

Les alertes partent désormais sur le téléphone lui-même, écran éteint,
tableau de bord fermé.

---

## Sans coût, sans fournisseur

Chaque navigateur fournit son propre service de push : Google pour Chrome et
Android, Mozilla, Apple, Microsoft. La plateforme y dépose un message
**chiffré de bout en bout** et signé par ses clés (VAPID). Aucun compte
tiers, aucune facturation au message — contrairement aux SMS, ce canal
respecte la règle « rien qui coûte à l'usage ».

Bibliothèque : `web-push` (dépendance de production, maintenue, sans service
associé).

## Qui est réveillé, et pour quoi

Une alerte ne réveille que les personnes qui ont le droit d'agir dessus.

| Événement | Restaurant | Urgent |
|---|---|---|
| Nouvelle commande | qui voit ou prépare les commandes (pas le livreur) | oui |
| Preuve de paiement déposée | qui voit les commandes | oui |
| Appel de table, demande d'addition | qui voit la salle | oui |
| Réservation | qui gère les réservations (pas la cuisine) | non |
| Abonnement qui expire | qui voit l'abonnement | non |

| Événement | Boutique |
|---|---|
| Rupture, stock faible | qui voit le stock ou passe les commandes fournisseurs |
| Paiement de crédit reçu | qui gère les crédits ou voit les finances |
| Abonnement qui expire | qui voit l'abonnement |

Ne partent **jamais** en push : un changement de statut de commande et un
réglage modifié. C'est l'équipe elle-même qui les a provoqués ; les recevoir
sur son téléphone serait du bruit.

Une alerte « urgente » est envoyée en priorité haute et reste affichée tant
qu'on ne la touche pas ; elle expire au bout d'une heure — une commande vieille
d'une heure n'a plus rien d'urgent. Les autres vivent six heures.

## Côté commerçant

- **Un réglage par appareil**, pas par compte : un patron peut vouloir être
  réveillé sur son téléphone sans que la tablette de la caisse sonne.
- Page **Notifications** des deux tableaux de bord : activer, envoyer un
  essai, désactiver. Un essai part automatiquement à l'activation.
- **Accueil Restaurant** : une invitation pour ceux qui reçoivent les
  commandes, avec « Plus tard » (mémorisé sur l'appareil).
- Chaque état explique quoi faire : navigateur trop ancien ; **iPhone**, qui
  exige d'ajouter MagyaPro à l'écran d'accueil avant toute notification ;
  autorisation refusée, à rétablir dans les réglages du navigateur.
- Toucher l'alerte ouvre la commande concernée, dans l'onglet déjà ouvert s'il
  y en a un.

## Sécurité

- **Liste fermée des services de push.** Le serveur envoie une requête à
  l'adresse fournie par le navigateur : sans liste, n'importe qui pourrait
  enregistrer une adresse arbitraire — y compris interne — et la faire
  appeler par le serveur. Seuls Google, Mozilla, Apple et Microsoft sont
  acceptés, en HTTPS. Couvert par des tests.
- Un abonnement est rattaché au compte connecté ; on ne peut désabonner que
  le sien. Le message d'essai ne vise que ses propres appareils.
- Le contenu est chiffré pour l'appareil : le service de push ne peut pas le
  lire.
- Le clic sur une notification n'ouvre que des pages de MagyaPro.

## Mise en production

### 1. La migration

Deux tables **nouvelles**, aucune table existante modifiée :
`prisma/migrations/20261012120000_web_push/migration.sql`.

Le code est sûr **avant** la migration : tant que les tables manquent, la
fonction se déclare « pas encore disponible », les commandes et les
notifications du tableau de bord fonctionnent comme avant. Vérifié en
renommant les tables sur une base de test : page Notifications affichée,
commande publique acceptée. Seule trace : une ligne `prisma:error` dans les
journaux du serveur lors d'une notification, interceptée par le code.

À exécuter sur la base de production (ou `npm run db:deploy`) :

```sql
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "push_keys" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Si vous passez par `psql` ou une console SQL plutôt que `db:deploy`, ajoutez
la ligne de suivi pour que Prisma ne tente pas de la rejouer plus tard :
`npx prisma migrate resolve --applied 20261012120000_web_push`.

### 2. Aucune configuration

Les clés de signature sont générées à la première utilisation et gardées dans
`push_keys`. Les variables `VAPID_*` (voir `.env.example`) ne servent qu'à
imposer des clés précises.

**Ne jamais régénérer ces clés** une fois des appareils abonnés : tous les
abonnements existants deviendraient muets, et chaque personne devrait
réactiver ses alertes.

## Ce qui a été vérifié

- **Chiffrement de bout en bout** : un vrai message envoyé par le moteur vers
  un service de push simulé, puis déchiffré avec la clé d'un « téléphone » —
  signature VAPID présente, contenu `aes128gcm`, message intact.
- **Destinataires** : le cuisinier reçoit les commandes mais pas les
  réservations, le livreur ne reçoit pas les commandes, une notification
  adressée à une personne ne vise qu'elle.
- **Liste des services** : adresses étrangères, HTTP, sous-domaine piégé
  (`fcm.googleapis.com.attaquant.example`), adresse de métadonnées cloud —
  toutes refusées.
- **Sans migration** : décrit plus haut.

## Ce qui ne l'a pas été

**La réception sur un vrai téléphone.** Le navigateur sans écran de cette
session ne peut pas s'abonner à un service de push réel. À faire par vous,
une fois la migration passée : page Notifications → Activer → l'essai doit
s'afficher. Puis verrouillez le téléphone et passez une commande depuis le
site : elle doit sonner.

**Cloudflare Workers.** `web-push` s'appuie sur les modules réseau de Node.
La production est sur Vercel, où ils sont disponibles ; un déploiement
Workers demanderait de le vérifier.
