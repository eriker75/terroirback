-- Peso de la bolsa: pasar de weightGrams (Int) a weightKg (Decimal 3 decimales).
-- Se conserva el dato existente convirtiendo gramos → kg (250 → 0.250, 1000 → 1.000).
ALTER TABLE "products" ADD COLUMN "weightKg" DECIMAL(7,3);
UPDATE "products" SET "weightKg" = "weightGrams"::numeric / 1000 WHERE "weightGrams" IS NOT NULL;
ALTER TABLE "products" DROP COLUMN "weightGrams";
