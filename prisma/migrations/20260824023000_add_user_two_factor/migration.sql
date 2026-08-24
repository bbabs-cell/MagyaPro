ALTER TYPE "VerificationTokenType" ADD VALUE 'TWO_FACTOR_LOGIN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;
