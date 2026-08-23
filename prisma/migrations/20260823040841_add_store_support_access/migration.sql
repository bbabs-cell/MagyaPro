-- CreateTable
CREATE TABLE "store_support_access" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "store_support_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_support_access_storeId_startedAt_idx" ON "store_support_access"("storeId", "startedAt");

-- CreateIndex
CREATE INDEX "store_support_access_adminUserId_startedAt_idx" ON "store_support_access"("adminUserId", "startedAt");

-- AddForeignKey
ALTER TABLE "store_support_access" ADD CONSTRAINT "store_support_access_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_support_access" ADD CONSTRAINT "store_support_access_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

