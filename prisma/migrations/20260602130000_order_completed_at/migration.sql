-- Añade orders.completedAt (timestamp del paso a COMPLETED). Nullable, sin
-- backfill: los pedidos completados antes de esta columna quedan con NULL y su
-- seguimiento público no expira por tiempo (sólo los nuevos COMPLETED registran
-- el momento). Ver OrdersService.findOneForTracking.
ALTER TABLE "orders" ADD COLUMN "completedAt" TIMESTAMP(3);
