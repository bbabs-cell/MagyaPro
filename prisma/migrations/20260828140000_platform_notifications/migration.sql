-- Notifications de l'espace Super Admin.
--
-- Modèle distinct de `notifications`, qui appartient toujours à un restaurant
-- ou une boutique : y ajouter un troisième cas romprait l'invariant
-- « restaurantId OU storeId » sur lequel repose l'isolation entre tenants.
--
-- `readAt` est partagé par tous les Super Admins : c'est une boîte commune.

CREATE TABLE "platform_notifications" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "href"      TEXT,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_notifications_readAt_createdAt_idx"
  ON "platform_notifications"("readAt", "createdAt");

-- Son joué à l'arrivée d'une notification dans l'espace Super Admin.
ALTER TABLE "platform_settings"
  ADD COLUMN "notificationSoundUrl" TEXT;
