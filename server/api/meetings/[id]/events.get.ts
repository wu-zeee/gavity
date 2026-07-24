import { D1MeetingRepository } from '#server/services/d1-meeting-repository';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const meetingId = Number.parseInt(getRouterParam(event, 'id') ?? '', 10);
  const after = Number.parseInt(getQuery(event).after?.toString() ?? '0', 10);
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0 || !Number.isSafeInteger(after) || after < 0)
    throw createError({ statusCode: 400, message: '查询参数无效' });

  const repository = new D1MeetingRepository(d1);
  if (!await repository.getParticipant(meetingId, user.id))
    throw createError({ statusCode: 403, message: '无权访问该会议' });
  return {
    events: await repository.listEvents(meetingId, after),
  };
});
