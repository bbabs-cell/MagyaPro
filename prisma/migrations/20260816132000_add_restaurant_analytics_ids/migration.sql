-- Identifiants Google Analytics / Meta Pixel propres à chaque restaurant.
ALTER TABLE "restaurant_settings" ADD COLUMN "googleAnalyticsId" TEXT;
ALTER TABLE "restaurant_settings" ADD COLUMN "metaPixelId" TEXT;
