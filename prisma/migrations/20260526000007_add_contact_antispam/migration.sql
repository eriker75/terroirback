-- CreateEnum
CREATE TYPE "ContactBlockType" AS ENUM ('EMAIL', 'IP', 'KEYWORD');

-- AlterTable: guardar la IP de origen del mensaje
ALTER TABLE "ContactMessage" ADD COLUMN "ipAddress" TEXT;

-- CreateTable: lista negra anti-spam
CREATE TABLE "ContactBlock" (
    "id"        TEXT         NOT NULL,
    "type"      "ContactBlockType" NOT NULL,
    "value"     TEXT         NOT NULL,
    "reason"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactBlock_type_value_key" ON "ContactBlock"("type", "value");

-- CreateIndex
CREATE INDEX "ContactBlock_type_idx" ON "ContactBlock"("type");
