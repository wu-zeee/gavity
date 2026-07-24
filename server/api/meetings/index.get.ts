import { listMeetings } from '#server/services/catalog-service';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  return listMeetings(d1, user.id);
});
