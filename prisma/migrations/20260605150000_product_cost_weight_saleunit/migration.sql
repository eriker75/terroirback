-- products: eliminar wholesalePrice (feature B2B diferida, valores null) y agregar
-- cost (solo admin), unitaryWeightPrice (precio por kg, público), weight (descriptor),
-- saleUnit (UNIT/WEIGHT). Ensanchar stock Int -> Decimal(12,3) para venta por peso.
ALTER TABLE "products" DROP COLUMN "wholesalePrice";
ALTER TABLE "products" ADD COLUMN "cost" DECIMAL(12,2);
ALTER TABLE "products" ADD COLUMN "unitaryWeightPrice" DECIMAL(12,2);
ALTER TABLE "products" ADD COLUMN "weight" TEXT;
ALTER TABLE "products" ADD COLUMN "saleUnit" TEXT NOT NULL DEFAULT 'UNIT';
ALTER TABLE "products" ALTER COLUMN "stock" SET DATA TYPE DECIMAL(12,3);

-- cart_items: ensanchar quantity Int -> Decimal(12,3) (cantidades fraccionadas en kg).
ALTER TABLE "cart_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- order_items: ensanchar quantity Int -> Decimal(12,3) y agregar costSnapshot
-- (snapshot del costo al vender; null en órdenes históricas).
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);
ALTER TABLE "order_items" ADD COLUMN "costSnapshot" DECIMAL(12,2);
