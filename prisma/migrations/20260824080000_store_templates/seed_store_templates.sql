-- À exécuter APRÈS migration.sql (table "store_templates" doit déjà exister).
-- Crée les 4 templates du site public MagyaPro Boutique — sans effet si
-- déjà présents (clé unique, ON CONFLICT DO NOTHING).

INSERT INTO "store_templates" (
  "id", "key", "name", "description", "isActive", "position", "createdAt", "updatedAt"
) VALUES
  (
    gen_random_uuid()::text, 'classic', 'Classique',
    'Épuré et polyvalent, catalogue en grille — convient à tout type de commerce.',
    true, 0, now(), now()
  ),
  (
    gen_random_uuid()::text, 'mode', 'Mode',
    'Grandes photos, mise en avant du visuel — pensé pour l''habillement et les accessoires.',
    true, 1, now(), now()
  ),
  (
    gen_random_uuid()::text, 'vitrine', 'Vitrine',
    'Grille dense, prix visibles — pensé pour l''électronique et les commerces à large catalogue.',
    true, 2, now(), now()
  ),
  (
    gen_random_uuid()::text, 'marche', 'Marché',
    'Liste compacte façon étal, prix en avant — pensé pour l''alimentation et l''épicerie.',
    true, 3, now(), now()
  )
ON CONFLICT ("key") DO NOTHING;
