-- Nouveaux secteurs d'activité Boutique.
-- Chaque secteur n'est qu'un profil d'unités et d'attributs suggérés : la
-- logique de stock reste unique pour tous les métiers.
--
-- À exécuter AVANT `20260827090000_units_engine`. Séparé du reste parce que
-- PostgreSQL interdit d'utiliser une valeur d'enum dans la transaction qui
-- vient de l'ajouter.

ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'SHOES';
ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'HARDWARE';
ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'CONSTRUCTION';
ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'HOUSEHOLD';
ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'PHARMACY';
ALTER TYPE "StoreBusinessType" ADD VALUE IF NOT EXISTS 'GENERAL';
