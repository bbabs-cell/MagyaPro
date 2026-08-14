-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_PROOF_SUBMITTED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "proofImageUrl" TEXT,
ADD COLUMN     "proofSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "restaurant_settings" ADD COLUMN     "orangeMoneyNumber" TEXT,
ADD COLUMN     "waveNumber" TEXT;
