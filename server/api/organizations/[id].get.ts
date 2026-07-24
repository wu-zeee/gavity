import { getOrganization } from '#server/services/catalog-service';
import { throwCatalogError } from '#server/utils/catalog-error';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const organizationId = getRouterParam(event, 'id');
  if (!organizationId)
    throw createError({ statusCode: 400, message: '组织编号无效' });
  try {
    return await getOrganization(d1, user.id, organizationId);
  } catch (error) {
    throwCatalogError(error);
  }
});
