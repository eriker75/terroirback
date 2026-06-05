-- Café en bolsas estandarizadas: se revierte el modelo de venta por peso fraccionado.
-- products: eliminar saleUnit, unitaryWeightPrice y weight(texto); agregar weightGrams
-- (identificador en gramos, filtrable). Mantener cost.
ALTER TABLE "products" DROP COLUMN "saleUnit";
ALTER TABLE "products" DROP COLUMN "unitaryWeightPrice";
ALTER TABLE "products" DROP COLUMN "weight";
ALTER TABLE "products" ADD COLUMN "weightGrams" INTEGER;

-- Revertir stock y cantidades a entero (la compra es por unidades/bolsas). Los valores
-- actuales ya son enteros (verificado), así que la conversión es segura.
ALTER TABLE "products" ALTER COLUMN "stock" SET DATA TYPE INTEGER USING "stock"::integer;
ALTER TABLE "cart_items" ALTER COLUMN "quantity" SET DATA TYPE INTEGER USING "quantity"::integer;
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE INTEGER USING "quantity"::integer;
