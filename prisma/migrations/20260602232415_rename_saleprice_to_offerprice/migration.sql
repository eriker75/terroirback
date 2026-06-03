/*
  Warnings:

  - You are about to drop the column `salePrice` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "salePrice",
ADD COLUMN     "offerPrice" DECIMAL(65,30);
