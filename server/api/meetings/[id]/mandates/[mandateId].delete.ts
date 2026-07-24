import { revokeMandate } from '#server/services/catalog-service';
import { throwCatalogError } from '#server/utils/catalog-error';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const meetingId = Number.parseInt(getRouterParam(event, 'id') ?? '', 10);
  const mandateId = getRouterParam(event, 'mandateId');
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0 || !mandateId)
    throw createError({ statusCode: 400, message: '授权参数无效' });
  try {
    return await revokeMandate(d1, user.id, meetingId, mandateId);
  } catch (error) {
    throwCatalogError(error);
  }
});
