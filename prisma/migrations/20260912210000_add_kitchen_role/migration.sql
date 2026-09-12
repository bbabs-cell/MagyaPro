-- MagyaPro — phase 9 : rôle Cuisine
--
-- Ajoute la valeur « KITCHEN » à l'énumération des rôles d'équipe d'un
-- restaurant.
--
-- Pourquoi : il n'existait aucun rôle convenant à un cuisinier. Pour lui
-- donner accès à l'écran de préparation, il fallait le déclarer « Employé »,
-- ce qui lui ouvrait du même geste le fichier clients, les réservations, le
-- plan de salle et les livraisons.
--
-- Cette migration est purement additive :
--   • aucune ligne existante n'est modifiée ;
--   • aucun rôle actuel ne change de sens ;
--   • personne ne gagne ni ne perd d'accès tant qu'un propriétaire n'a pas
--     explicitement attribué le nouveau rôle à quelqu'un.
--
-- Elle est aussi réexécutable sans risque : si la valeur existe déjà, rien ne
-- se passe.

ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'KITCHEN';
