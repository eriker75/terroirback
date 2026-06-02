-- Soft delete de usuarios/clientes. En vez de borrar la fila (lo que arrastraría
-- en cascada o bloquearía por los pedidos asociados), el admin marca `deletedAt`.
-- La información del cliente se conserva intacta; las consultas de listado, stats
-- y autenticación filtran las filas con deletedAt != NULL.
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Se filtra en cada listado/stat, conviene indexarlo.
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
