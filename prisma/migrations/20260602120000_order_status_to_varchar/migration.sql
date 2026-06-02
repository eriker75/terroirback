-- Convierte orders.status del enum físico "OrderStatus" (PENDING, PAID, SHIPPED,
-- CANCELLED) a VARCHAR(50) libre. El conjunto de estados válido se valida ahora
-- a nivel de TypeScript (enum OrderStatus en src/orders/order-status.enum.ts:
-- PENDING, PREPARING, SENDING, COMPLETED, CANCELLED), NO con un type de Postgres,
-- para poder añadir estados futuros sin migraciones de enum.
--
-- Se preservan/remapean los datos: PAID -> PREPARING, SHIPPED -> SENDING
-- (PENDING y CANCELLED se conservan). `payments.status` ya era TEXT y no se toca.
-- `orders.status` es el único objeto que usa el type "OrderStatus", por lo que
-- DROP TYPE al final es seguro.

-- 1) Quitar el DEFAULT ligado al enum antes de cambiar el tipo de la columna
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

-- 2) Convertir la columna a VARCHAR(50), mapeando los valores renombrados
ALTER TABLE "orders" ALTER COLUMN "status" TYPE VARCHAR(50) USING (
  CASE "status"::text
    WHEN 'PAID' THEN 'PREPARING'
    WHEN 'SHIPPED' THEN 'SENDING'
    ELSE "status"::text
  END
);

-- 3) Restaurar el DEFAULT como string
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 4) Eliminar el type enum (ya sin uso)
DROP TYPE "OrderStatus";
