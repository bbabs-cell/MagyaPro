-- Reprise du suivi de dette fournisseur.
--
-- Avant : `boutique_suppliers.debtBalance` était un compteur, augmenté à
-- chaque réception et diminué à chaque règlement. Un compteur de ce genre est
-- une seconde vérité : il résume des faits déjà écrits ailleurs, et il finit
-- par s'en écarter sans que rien ne le signale.
--
-- Après : le montant dû à un fournisseur se déduit de ses commandes — la
-- valeur de ce qui a été livré, moins les règlements rattachés à chaque
-- commande. Plus rien à tenir à jour, donc plus rien qui puisse dériver.
--
-- Cette migration ne change aucune structure : elle reprend seulement
-- l'historique pour que l'affichage déduit corresponde à ce que le compteur
-- indiquait. Aucune colonne n'est ajoutée ni supprimée.

-- 1. Les règlements déjà rattachés à une commande précise sont conservés tels
--    quels : ils sont exacts et deviennent la source du montant payé.

-- 2. Un fournisseur dont le compteur était à zéro ou négatif n'avait plus rien
--    à devoir. Pour chacune de ses commandes livrées et non couverte par un
--    règlement rattaché, on inscrit un règlement de reprise du montant
--    exactement manquant. La note rend l'opération traçable : ces lignes ne
--    prétendent pas être des paiements réels d'époque.
INSERT INTO "boutique_supplier_payments"
  ("id", "storeId", "supplierId", "purchaseOrderId", "amount", "paidAt", "note", "createdAt")
SELECT
  'mig_' || substr(md5(random()::text || po."id"), 1, 20),
  po."storeId",
  po."supplierId",
  po."id",
  du."livre" - COALESCE(regle."paye", 0),
  NOW(),
  'Reprise de l''ancien suivi de dette : ce fournisseur était à jour.',
  NOW()
FROM "boutique_purchase_orders" po
JOIN "boutique_suppliers" s ON s."id" = po."supplierId"
JOIN LATERAL (
  -- Valeur réellement livrée, avec la même formule que la réception :
  -- (quantité reçue / facteur d'achat) x (coût unitaire - remise).
  SELECT COALESCE(SUM(
    ROUND(
      (poi."quantityReceived" / NULLIF(poi."unitFactor", 0))
      * GREATEST(poi."unitCost" - poi."discount", 0)
    )
  ), 0)::int AS "livre"
  FROM "boutique_purchase_order_items" poi
  WHERE poi."purchaseOrderId" = po."id"
) du ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(sp."amount"), 0)::int AS "paye"
  FROM "boutique_supplier_payments" sp
  WHERE sp."purchaseOrderId" = po."id"
) regle ON TRUE
WHERE s."debtBalance" <= 0
  AND du."livre" > COALESCE(regle."paye", 0);

-- 3. Le compteur n'est plus lu par aucun code. Il est remis à zéro pour qu'un
--    reste de valeur ne puisse pas être pris pour une information vivante.
UPDATE "boutique_suppliers" SET "debtBalance" = 0 WHERE "debtBalance" <> 0;
