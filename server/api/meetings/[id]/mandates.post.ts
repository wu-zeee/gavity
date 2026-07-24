import { createMandate } from '#server/services/catalog-service';
import { throwCatalogError } from '#server/utils/catalog-error';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';
import { CreateMandateInput } from '#shared/contracts/meetings';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const meetingId = Number.parseInt(getRouterParam(event, 'id') ?? '', 10);
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0)
    throw createError({ statusCode: 400, message: '会议编号无效' });
  const input = await readValidatedBody(event, body => CreateMandateInput.parse(body));
  try {
    return await createMandate(d1, user.id, meetingId, input);
  } catch (error) {
    throwCatalogError(error);
  }
});
