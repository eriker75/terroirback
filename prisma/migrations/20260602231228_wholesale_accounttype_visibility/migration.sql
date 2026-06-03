-- AlterTable
ALTER TABLE "products" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN     "wholesalePrice" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'B2C';
