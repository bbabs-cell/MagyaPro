-- Position GPS en direct du livreur, pour le suivi de livraison.
ALTER TABLE "orders" ADD COLUMN "courierLat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "courierLng" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "courierLocationUpdatedAt" TIMESTAMP(3);
