-- À exécuter APRÈS migration.sql (colonne "product" doit déjà exister).
-- Crée les 3 plans MagyaPro Boutique (Starter/Pro/Premium) — sans effet si
-- déjà présents (clé unique, ON CONFLICT DO NOTHING).

INSERT INTO "plans" (
  "id", "key", "product", "name", "description",
  "price", "currency", "interval", "trialDays",
  "features", "limits", "isActive", "position",
  "createdAt", "updatedAt"
) VALUES
  (
    gen_random_uuid()::text, 'store_starter', 'STORE', 'Starter',
    'Pour démarrer : caisse, stock et ventes.',
    0, 'XOF', 'MONTH', 30,
    ARRAY[]::text[], '{"maxProducts": 20, "maxUsers": 1}'::jsonb,
    true, 0, now(), now()
  ),
  (
    gen_random_uuid()::text, 'store_pro', 'STORE', 'Pro',
    'Pour développer : plus de produits et une équipe.',
    10000, 'XOF', 'MONTH', 14,
    ARRAY['multiple_users']::text[], '{"maxProducts": 200, "maxUsers": 5}'::jsonb,
    true, 1, now(), now()
  ),
  (
    gen_random_uuid()::text, 'store_premium', 'STORE', 'Premium',
    'Pour aller plus loin : catalogue et équipe sans limite.',
    25000, 'XOF', 'MONTH', 14,
    ARRAY['multiple_users']::text[], '{"maxProducts": -1, "maxUsers": 20}'::jsonb,
    true, 2, now(), now()
  )
ON CONFLICT ("key") DO NOTHING;
