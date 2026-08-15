-- Enregistre le nouveau template « street-food » dans la table `templates`,
-- qui contrôle sa disponibilité dans l'interface (Apparence, Administration,
-- onboarding) — son rendu existe déjà dans le code, cette ligne le rend
-- sélectionnable.
INSERT INTO "templates" ("id", "key", "name", "description", "previewImageUrl", "isActive", "position", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'street-food',
  'Street Food',
  'Page unique énergique : bandeau défilant, badges flottants, carte filtrable et offre en compte à rebours.',
  NULL,
  true,
  5,
  now(),
  now()
);
