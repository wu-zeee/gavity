import { D1MeetingRepository } from '#server/services/d1-meeting-repository';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const meetingId = Number.parseInt(getRouterParam(event, 'id') ?? '', 10);
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0)
    throw createError({ statusCode: 400, message: '会议编号无效' });

  const repository = new D1MeetingRepository(d1);
  const participant = await repository.getParticipant(meetingId, user.id);
  if (!participant)
    throw createError({ statusCode: 403, message: '无权访问该会议' });
  const meeting = await repository.getMeeting(meetingId);
  if (!meeting)
    throw createError({ statusCode: 404, message: '会议不存在' });

  return {
    state: meeting.state,
    version: meeting.version,
    participant,
  };
});
