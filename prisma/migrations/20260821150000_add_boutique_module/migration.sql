-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SALESPERSON', 'STOCK_MANAGER', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StoreBusinessType" AS ENUM ('CLOTHING', 'ELECTRONICS', 'COSMETICS', 'GROCERY', 'OTHER');

-- CreateEnum
CREATE TYPE "StoreDomainType" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StoreDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "StoreProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'INITIAL');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StoreReturnResolution" AS ENUM ('REFUND', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SALE', 'DEPOSIT', 'WITHDRAWAL', 'EXPENSE');

-- CreateEnum
CREATE TYPE "StoreExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'STAFF', 'TRANSPORT', 'MARKETING', 'MAINTENANCE', 'SUPPLIES', 'OTHER');

-- CreateEnum
CREATE TYPE "StorePromotionType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "store_users" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'SALESPERSON',
    "extraPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "businessType" "StoreBusinessType" NOT NULL DEFAULT 'OTHER',
    "status" "StoreStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#b45309',
    "secondaryColor" TEXT NOT NULL DEFAULT '#12151a',
    "phone" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Abidjan',
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "saleCounter" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_domains" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "type" "StoreDomainType" NOT NULL DEFAULT 'CUSTOM',
    "status" "StoreDomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_subscriptions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiryAlertSentAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_subscription_payments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "country" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "proofImageUrl" TEXT,
    "proofSubmittedAt" TIMESTAMP(3),
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_brands" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_categories" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "status" "StoreProductStatus" NOT NULL DEFAULT 'DRAFT',
    "minStockAlert" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "cost" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_warehouses" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_inventory" (
    "id" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_inventory_movements" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_stock_transfers" (
    "id" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_stock_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "boutique_stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_suppliers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "debtBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_supplier_payments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_purchase_orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "extraFees" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "boutique_purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_customers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "lastSaleAt" TIMESTAMP(3),
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_credit_payments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_credit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "customerId" TEXT,
    "cashSessionId" TEXT,
    "userId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "creditAmount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "promotionId" TEXT,

    CONSTRAINT "boutique_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,

    CONSTRAINT "boutique_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_payment_methods" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_returns" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "status" "StoreReturnStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" "StoreReturnResolution",
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "boutique_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_cash_registers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_cash_sessions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingBalance" INTEGER NOT NULL,
    "expectedBalance" INTEGER,
    "countedBalance" INTEGER,
    "difference" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "boutique_cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_cash_movements" (
    "id" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_expenses" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "StoreExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_invoices" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_promotions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "StorePromotionType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minCartAmount" INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boutique_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_users_userId_idx" ON "store_users"("userId");

-- CreateIndex
CREATE INDEX "store_users_storeId_idx" ON "store_users"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "store_users_storeId_userId_key" ON "store_users"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "stores_status_idx" ON "stores"("status");

-- CreateIndex
CREATE UNIQUE INDEX "store_domains_hostname_key" ON "store_domains"("hostname");

-- CreateIndex
CREATE INDEX "store_domains_storeId_idx" ON "store_domains"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "store_subscriptions_storeId_key" ON "store_subscriptions"("storeId");

-- CreateIndex
CREATE INDEX "store_subscriptions_status_idx" ON "store_subscriptions"("status");

-- CreateIndex
CREATE INDEX "store_subscription_payments_storeId_status_idx" ON "store_subscription_payments"("storeId", "status");

-- CreateIndex
CREATE INDEX "store_subscription_payments_status_idx" ON "store_subscription_payments"("status");

-- CreateIndex
CREATE INDEX "boutique_brands_storeId_idx" ON "boutique_brands"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_brands_storeId_name_key" ON "boutique_brands"("storeId", "name");

-- CreateIndex
CREATE INDEX "boutique_categories_storeId_idx" ON "boutique_categories"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_categories_storeId_name_parentId_key" ON "boutique_categories"("storeId", "name", "parentId");

-- CreateIndex
CREATE INDEX "boutique_products_storeId_status_idx" ON "boutique_products"("storeId", "status");

-- CreateIndex
CREATE INDEX "boutique_products_categoryId_idx" ON "boutique_products"("categoryId");

-- CreateIndex
CREATE INDEX "boutique_products_brandId_idx" ON "boutique_products"("brandId");

-- CreateIndex
CREATE INDEX "boutique_product_variants_productId_idx" ON "boutique_product_variants"("productId");

-- CreateIndex
CREATE INDEX "boutique_product_variants_barcode_idx" ON "boutique_product_variants"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_product_variants_productId_sku_key" ON "boutique_product_variants"("productId", "sku");

-- CreateIndex
CREATE INDEX "boutique_warehouses_storeId_idx" ON "boutique_warehouses"("storeId");

-- CreateIndex
CREATE INDEX "boutique_inventory_warehouseId_idx" ON "boutique_inventory"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_inventory_productVariantId_warehouseId_key" ON "boutique_inventory"("productVariantId", "warehouseId");

-- CreateIndex
CREATE INDEX "boutique_inventory_movements_storeId_createdAt_idx" ON "boutique_inventory_movements"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_inventory_movements_productVariantId_createdAt_idx" ON "boutique_inventory_movements"("productVariantId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_inventory_movements_warehouseId_createdAt_idx" ON "boutique_inventory_movements"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_stock_transfers_fromWarehouseId_idx" ON "boutique_stock_transfers"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "boutique_stock_transfers_toWarehouseId_idx" ON "boutique_stock_transfers"("toWarehouseId");

-- CreateIndex
CREATE INDEX "boutique_stock_transfer_items_transferId_idx" ON "boutique_stock_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "boutique_suppliers_storeId_idx" ON "boutique_suppliers"("storeId");

-- CreateIndex
CREATE INDEX "boutique_supplier_payments_storeId_idx" ON "boutique_supplier_payments"("storeId");

-- CreateIndex
CREATE INDEX "boutique_supplier_payments_supplierId_paidAt_idx" ON "boutique_supplier_payments"("supplierId", "paidAt");

-- CreateIndex
CREATE INDEX "boutique_purchase_orders_storeId_status_idx" ON "boutique_purchase_orders"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_purchase_orders_storeId_reference_key" ON "boutique_purchase_orders"("storeId", "reference");

-- CreateIndex
CREATE INDEX "boutique_purchase_order_items_purchaseOrderId_idx" ON "boutique_purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "boutique_customers_storeId_idx" ON "boutique_customers"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_customers_storeId_phone_key" ON "boutique_customers"("storeId", "phone");

-- CreateIndex
CREATE INDEX "boutique_credit_payments_storeId_idx" ON "boutique_credit_payments"("storeId");

-- CreateIndex
CREATE INDEX "boutique_credit_payments_customerId_paidAt_idx" ON "boutique_credit_payments"("customerId", "paidAt");

-- CreateIndex
CREATE INDEX "boutique_sales_storeId_createdAt_idx" ON "boutique_sales"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_sales_customerId_idx" ON "boutique_sales"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_sales_storeId_number_key" ON "boutique_sales"("storeId", "number");

-- CreateIndex
CREATE INDEX "boutique_sale_items_saleId_idx" ON "boutique_sale_items"("saleId");

-- CreateIndex
CREATE INDEX "boutique_sale_items_productVariantId_idx" ON "boutique_sale_items"("productVariantId");

-- CreateIndex
CREATE INDEX "boutique_payments_saleId_idx" ON "boutique_payments"("saleId");

-- CreateIndex
CREATE INDEX "boutique_payment_methods_storeId_idx" ON "boutique_payment_methods"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_payment_methods_storeId_method_key" ON "boutique_payment_methods"("storeId", "method");

-- CreateIndex
CREATE INDEX "boutique_returns_storeId_createdAt_idx" ON "boutique_returns"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_returns_saleId_idx" ON "boutique_returns"("saleId");

-- CreateIndex
CREATE INDEX "boutique_return_items_returnId_idx" ON "boutique_return_items"("returnId");

-- CreateIndex
CREATE INDEX "boutique_cash_registers_storeId_idx" ON "boutique_cash_registers"("storeId");

-- CreateIndex
CREATE INDEX "boutique_cash_sessions_storeId_status_idx" ON "boutique_cash_sessions"("storeId", "status");

-- CreateIndex
CREATE INDEX "boutique_cash_sessions_cashRegisterId_idx" ON "boutique_cash_sessions"("cashRegisterId");

-- CreateIndex
CREATE INDEX "boutique_cash_movements_cashSessionId_createdAt_idx" ON "boutique_cash_movements"("cashSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "boutique_expenses_storeId_incurredAt_idx" ON "boutique_expenses"("storeId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_invoices_saleId_key" ON "boutique_invoices"("saleId");

-- CreateIndex
CREATE INDEX "boutique_invoices_storeId_idx" ON "boutique_invoices"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_invoices_storeId_number_key" ON "boutique_invoices"("storeId", "number");

-- CreateIndex
CREATE INDEX "boutique_promotions_storeId_idx" ON "boutique_promotions"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "boutique_promotions_storeId_code_key" ON "boutique_promotions"("storeId", "code");

-- CreateIndex
CREATE INDEX "notifications_storeId_readAt_idx" ON "notifications"("storeId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_storeId_createdAt_idx" ON "audit_logs"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_users" ADD CONSTRAINT "store_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_domains" ADD CONSTRAINT "store_domains_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_subscriptions" ADD CONSTRAINT "store_subscriptions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_subscriptions" ADD CONSTRAINT "store_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_subscription_payments" ADD CONSTRAINT "store_subscription_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_subscription_payments" ADD CONSTRAINT "store_subscription_payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_brands" ADD CONSTRAINT "boutique_brands_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_categories" ADD CONSTRAINT "boutique_categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_categories" ADD CONSTRAINT "boutique_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "boutique_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_products" ADD CONSTRAINT "boutique_products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_products" ADD CONSTRAINT "boutique_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "boutique_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_products" ADD CONSTRAINT "boutique_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "boutique_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_products" ADD CONSTRAINT "boutique_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "boutique_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_product_variants" ADD CONSTRAINT "boutique_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "boutique_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_warehouses" ADD CONSTRAINT "boutique_warehouses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_inventory" ADD CONSTRAINT "boutique_inventory_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_inventory" ADD CONSTRAINT "boutique_inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "boutique_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_inventory_movements" ADD CONSTRAINT "boutique_inventory_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_inventory_movements" ADD CONSTRAINT "boutique_inventory_movements_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_inventory_movements" ADD CONSTRAINT "boutique_inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "boutique_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_stock_transfers" ADD CONSTRAINT "boutique_stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "boutique_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_stock_transfers" ADD CONSTRAINT "boutique_stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "boutique_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_stock_transfer_items" ADD CONSTRAINT "boutique_stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "boutique_stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_suppliers" ADD CONSTRAINT "boutique_suppliers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_supplier_payments" ADD CONSTRAINT "boutique_supplier_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_supplier_payments" ADD CONSTRAINT "boutique_supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "boutique_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_purchase_orders" ADD CONSTRAINT "boutique_purchase_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_purchase_orders" ADD CONSTRAINT "boutique_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "boutique_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_purchase_order_items" ADD CONSTRAINT "boutique_purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "boutique_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_purchase_order_items" ADD CONSTRAINT "boutique_purchase_order_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_customers" ADD CONSTRAINT "boutique_customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_credit_payments" ADD CONSTRAINT "boutique_credit_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_credit_payments" ADD CONSTRAINT "boutique_credit_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "boutique_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sales" ADD CONSTRAINT "boutique_sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sales" ADD CONSTRAINT "boutique_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "boutique_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sales" ADD CONSTRAINT "boutique_sales_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "boutique_cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sales" ADD CONSTRAINT "boutique_sales_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "boutique_promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sale_items" ADD CONSTRAINT "boutique_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "boutique_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_sale_items" ADD CONSTRAINT "boutique_sale_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_payments" ADD CONSTRAINT "boutique_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "boutique_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_returns" ADD CONSTRAINT "boutique_returns_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_returns" ADD CONSTRAINT "boutique_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "boutique_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_return_items" ADD CONSTRAINT "boutique_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "boutique_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_return_items" ADD CONSTRAINT "boutique_return_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "boutique_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_cash_registers" ADD CONSTRAINT "boutique_cash_registers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_cash_sessions" ADD CONSTRAINT "boutique_cash_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_cash_sessions" ADD CONSTRAINT "boutique_cash_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "boutique_cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_cash_movements" ADD CONSTRAINT "boutique_cash_movements_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "boutique_cash_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_expenses" ADD CONSTRAINT "boutique_expenses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_invoices" ADD CONSTRAINT "boutique_invoices_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_invoices" ADD CONSTRAINT "boutique_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "boutique_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_promotions" ADD CONSTRAINT "boutique_promotions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

