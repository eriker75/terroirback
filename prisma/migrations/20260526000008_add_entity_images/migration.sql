-- CreateTable: galería de imágenes de productos
CREATE TABLE "product_images" (
    "id"        TEXT         NOT NULL,
    "productId" TEXT         NOT NULL,
    "url"       TEXT         NOT NULL,
    "pathName"  TEXT         NOT NULL,
    "filename"  TEXT         NOT NULL,
    "mimeType"  TEXT         NOT NULL,
    "size"      INTEGER      NOT NULL,
    "position"  INTEGER      NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable: galería de imágenes de categorías
CREATE TABLE "category_images" (
    "id"         TEXT         NOT NULL,
    "categoryId" TEXT         NOT NULL,
    "url"        TEXT         NOT NULL,
    "pathName"   TEXT         NOT NULL,
    "filename"   TEXT         NOT NULL,
    "mimeType"   TEXT         NOT NULL,
    "size"       INTEGER      NOT NULL,
    "position"   INTEGER      NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");
CREATE INDEX "category_images_categoryId_idx" ON "category_images"("categoryId");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_images" ADD CONSTRAINT "category_images_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
