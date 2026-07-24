import { addOrganizationMember } from '#server/services/catalog-service';
import { throwCatalogError } from '#server/utils/catalog-error';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';
import { AddOrganizationMemberInput } from '#shared/contracts/meetings';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const organizationId = getRouterParam(event, 'id');
  if (!organizationId)
    throw createError({ statusCode: 400, message: '组织编号无效' });
  const input = await readValidatedBody(event, body => AddOrganizationMemberInput.parse(body));
  try {
    return await addOrganizationMember(d1, user.id, organizationId, input);
  } catch (error) {
    throwCatalogError(error);
  }
});
