import ExcelJS from 'exceljs';

import { prisma } from '@/lib/db';
import { requireStore } from '@/lib/boutique/store-tenant';
import { toQty } from '@/lib/boutique/quantity';
import { UNIT_LABELS } from '@/lib/boutique/units';

/**
 * Export du catalogue en Excel — même schéma de colonnes que l'import
 * (`/api/boutique/produits/import`) : la colonne ID n'est là que pour faire
 * le lien au réimport, elle ne doit pas être modifiée. Seuls Prix, Coût et
 * Stock sont pris en compte à l'import ; les autres colonnes sont
 * informatives (renommer un produit se fait toujours depuis Produits).
 */
export async function GET() {
  const context = await requireStore('products:view');

  const products = await prisma.storeProduct.findMany({
    where: { storeId: context.store.id },
    orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
    select: {
      name: true,
      unit: true,
      category: { select: { name: true } },
      variants: {
        select: {
          id: true,
          sku: true,
          barcode: true,
          price: true,
          cost: true,
          inventory: { select: { quantity: true } },
        },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produits');
  sheet.columns = [
    { header: 'ID (ne pas modifier)', key: 'id', width: 28 },
    { header: 'Catégorie', key: 'category', width: 18 },
    { header: 'Produit', key: 'product', width: 28 },
    { header: 'Variante', key: 'variant', width: 16 },
    { header: 'Code-barres', key: 'barcode', width: 16 },
    { header: 'Prix', key: 'price', width: 12 },
    { header: 'Coût', key: 'cost', width: 12 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Unité', key: 'unit', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const product of products) {
    for (const variant of product.variants) {
      const stock = variant.inventory.reduce((sum, inv) => sum + toQty(inv.quantity), 0);
      sheet.addRow({
        id: variant.id,
        category: product.category?.name ?? '',
        product: product.name,
        variant: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        price: variant.price,
        cost: variant.cost,
        stock,
        unit: UNIT_LABELS[product.unit],
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="catalogue-${context.store.slug}.xlsx"`,
    },
  });
}
