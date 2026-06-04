-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "metaGroup" TEXT;

-- CreateIndex
CREATE INDEX "user_settings_metaGroup_idx" ON "user_settings"("metaGroup");
