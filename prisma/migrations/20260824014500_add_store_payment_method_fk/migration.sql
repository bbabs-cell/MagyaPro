ALTER TABLE "boutique_payment_methods" ADD CONSTRAINT "boutique_payment_methods_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
