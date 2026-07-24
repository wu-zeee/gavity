import { createMeeting } from '#server/services/catalog-service';
import { throwCatalogError } from '#server/utils/catalog-error';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';
import { CreateMeetingInput } from '#shared/contracts/meetings';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const input = await readValidatedBody(event, body => CreateMeetingInput.parse(body));
  try {
    return await createMeeting(d1, user.id, input);
  } catch (error) {
    throwCatalogError(error);
  }
});
