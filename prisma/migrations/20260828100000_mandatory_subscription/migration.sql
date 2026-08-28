-- Abonnement obligatoire après un mois d'essai.
--
-- Jusqu'ici, « Starter » à 0 F jouait deux rôles : plan d'essai ET plan de
-- repli permanent à l'expiration. Un plan gratuit à vie rend l'abonnement
-- facultatif de fait — il est donc retiré du catalogue.
--
-- Retiré, pas supprimé : des abonnements existants le référencent encore et
-- l'historique des paiements aussi. `isActive = false` le fait disparaître de
-- tous les écrans de choix sans rompre la moindre clé étrangère.

UPDATE "plans"
SET "isActive" = false
WHERE "key" IN ('starter', 'store_starter');

-- Un mois offert à l'inscription, sur tous les plans restants.
UPDATE "plans"
SET "trialDays" = 30
WHERE "isActive" = true;

-- Le plan d'entrée de chaque produit passe en première position : c'est lui
-- que l'inscription retient pour la période d'essai (voir `registerUser` et
-- `registerStoreAccount`, qui prennent le plan actif de position la plus
-- basse).
UPDATE "plans" SET "position" = 0 WHERE "key" = 'pro';
UPDATE "plans" SET "position" = 1 WHERE "key" = 'premium';
UPDATE "plans" SET "position" = 0 WHERE "key" = 'store_pro';
UPDATE "plans" SET "position" = 1 WHERE "key" = 'store_premium';

-- Les comptes déjà installés sur le plan gratuit basculent en essai d'un mois
-- sur le plan d'entrée, à compter d'aujourd'hui. Sans cela, ils seraient
-- bloqués du jour au lendemain sans avoir jamais eu la possibilité de payer.
UPDATE "subscriptions" s
SET "planId"           = (SELECT "id" FROM "plans" WHERE "key" = 'pro'),
    "status"           = 'TRIALING',
    "trialEndsAt"      = NOW() + INTERVAL '30 days',
    "currentPeriodEnd" = NOW() + INTERVAL '30 days',
    "graceEndsAt"      = NULL,
    "expiryAlertSentAt" = NULL
WHERE s."planId" = (SELECT "id" FROM "plans" WHERE "key" = 'starter');

UPDATE "store_subscriptions" s
SET "planId"           = (SELECT "id" FROM "plans" WHERE "key" = 'store_pro'),
    "status"           = 'TRIALING',
    "trialEndsAt"      = NOW() + INTERVAL '30 days',
    "currentPeriodEnd" = NOW() + INTERVAL '30 days',
    "graceEndsAt"      = NULL,
    "expiryAlertSentAt" = NULL
WHERE s."planId" = (SELECT "id" FROM "plans" WHERE "key" = 'store_starter');
