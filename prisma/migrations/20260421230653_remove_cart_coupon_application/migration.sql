/*
  Warnings:

  - You are about to drop the `CartCouponApplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CartCouponAppliedItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CartCouponApplication" DROP CONSTRAINT "CartCouponApplication_cartId_fkey";

-- DropForeignKey
ALTER TABLE "CartCouponApplication" DROP CONSTRAINT "CartCouponApplication_couponId_fkey";

-- DropForeignKey
ALTER TABLE "CartCouponAppliedItem" DROP CONSTRAINT "CartCouponAppliedItem_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "CartCouponAppliedItem" DROP CONSTRAINT "CartCouponAppliedItem_productId_fkey";

-- DropTable
DROP TABLE "CartCouponApplication";

-- DropTable
DROP TABLE "CartCouponAppliedItem";

-- DropEnum
DROP TYPE "CouponApplicationMode";
