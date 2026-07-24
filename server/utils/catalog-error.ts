import { CatalogError } from '#server/services/catalog-service';

export function throwCatalogError(error: unknown): never {
  if (!(error instanceof CatalogError))
    throw error;
  const statusCode = {
    'forbidden': 403,
    'not-found': 404,
    'conflict': 409,
  }[error.code];
  throw createError({ statusCode, message: error.message });
}
