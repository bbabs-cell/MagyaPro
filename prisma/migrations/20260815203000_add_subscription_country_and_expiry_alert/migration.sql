-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN "country" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "expiryAlertSentAt" TIMESTAMP(3);
