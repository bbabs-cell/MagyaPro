-- CreateEnum
CREATE TYPE "StoreWebhookEvent" AS ENUM ('SALE_CREATED', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'LOW_STOCK');

-- CreateTable
CREATE TABLE "store_api_keys" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_webhooks" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" "StoreWebhookEvent"[],
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_api_keys_keyHash_key" ON "store_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "store_api_keys_storeId_idx" ON "store_api_keys"("storeId");

-- CreateIndex
CREATE INDEX "store_webhooks_storeId_idx" ON "store_webhooks"("storeId");

-- AddForeignKey
ALTER TABLE "store_api_keys" ADD CONSTRAINT "store_api_keys_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_webhooks" ADD CONSTRAINT "store_webhooks_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

