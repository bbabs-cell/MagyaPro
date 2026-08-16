-- Offre de lancement plateforme : remise automatique sur le premier paiement d'abonnement.
ALTER TABLE "platform_settings" ADD COLUMN "promoDiscountPercent" INTEGER;
ALTER TABLE "platform_settings" ADD COLUMN "promoEndsAt" TIMESTAMP(3);
ALTER TABLE "platform_settings" ADD COLUMN "promoLabel" TEXT;
