// Valores válidos del segmento comercial del cliente y de la visibilidad de
// producto. Se modelan como String (no enums físicos de Postgres) por consistencia
// con `role`/`status`/order-status, validándose en TS. Se reutilizan en los DTOs
// (@IsIn) y en la lógica de filtrado/checkout.

export const ACCOUNT_TYPES = ['B2C', 'B2B'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PRODUCT_VISIBILITIES = ['ALL', 'RETAIL_ONLY', 'WHOLESALE_ONLY'] as const;
export type ProductVisibility = (typeof PRODUCT_VISIBILITIES)[number];

// ¿Puede un comprador de este `accountType` ver/comprar un producto con esta
// `visibility`? El admin se gestiona aparte (siempre ve todo).
//
// Regla: los productos B2C (ALL y RETAIL_ONLY) son SIEMPRE públicos — los ve
// cualquiera, incluido un mayorista. Solo WHOLESALE_ONLY se restringe (exclusivo
// de B2B). Un valor desconocido se trata como público.
export function canAccessVisibility(
  accountType: string | null | undefined,
  visibility: string | null | undefined,
): boolean {
  if (visibility === 'WHOLESALE_ONLY') return accountType === 'B2B';
  return true; // ALL, RETAIL_ONLY o desconocido → público
}
