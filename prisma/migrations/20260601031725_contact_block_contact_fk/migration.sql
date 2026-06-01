-- AlterTable
ALTER TABLE "contact_blocks" ADD COLUMN     "contactId" TEXT;

-- CreateIndex
CREATE INDEX "contact_blocks_contactId_idx" ON "contact_blocks"("contactId");

-- AddForeignKey
ALTER TABLE "contact_blocks" ADD CONSTRAINT "contact_blocks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
