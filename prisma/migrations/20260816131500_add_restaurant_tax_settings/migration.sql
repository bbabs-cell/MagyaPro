-- TVA optionnelle par restaurant : les prix restent TTC, le taux sert à afficher la ventilation sur les reçus.
ALTER TABLE "restaurant_settings" ADD COLUMN "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "restaurant_settings" ADD COLUMN "taxRate" DOUBLE PRECISION;
ALTER TABLE "restaurant_settings" ADD COLUMN "taxLabel" TEXT NOT NULL DEFAULT 'TVA';
