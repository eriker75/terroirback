-- CreateTable
CREATE TABLE "Setting" (
    "settingId" SERIAL       NOT NULL,
    "id"        TEXT         NOT NULL,
    "metaKey"   TEXT         NOT NULL,
    "metaValue" TEXT         NOT NULL,
    "metaGroup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("settingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_id_key" ON "Setting"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_metaKey_key" ON "Setting"("metaKey");

-- CreateIndex
CREATE INDEX "Setting_metaGroup_idx" ON "Setting"("metaGroup");
