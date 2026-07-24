import { createOrganization } from '#server/services/catalog-service';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';
import { CreateOrganizationInput } from '#shared/contracts/meetings';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const input = await readValidatedBody(event, body => CreateOrganizationInput.parse(body));
  return createOrganization(d1, user.id, input);
});
