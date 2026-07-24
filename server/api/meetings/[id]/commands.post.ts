import { D1MeetingRepository } from '#server/services/d1-meeting-repository';
import { MeetingCommandService } from '#server/services/meeting-command-service';
import { d1 } from '#server/utils/db';
import { requireUser } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const meetingId = Number.parseInt(getRouterParam(event, 'id') ?? '', 10);
  if (!Number.isSafeInteger(meetingId) || meetingId <= 0)
    throw createError({ statusCode: 400, message: '会议编号无效' });

  const body = await readBody(event);
  if (typeof body !== 'object' || body == null || body.meetingId !== meetingId)
    throw createError({ statusCode: 400, message: '命令与请求会议不一致' });

  const service = new MeetingCommandService(new D1MeetingRepository(d1));
  const result = await service.execute({ userId: user.id, command: body });
  if (result.status === 'accepted')
    return result;

  const statusCode = {
    'invalid': 400,
    'not-found': 404,
    'forbidden': 403,
    'rejected': 409,
    'requires-approval': 409,
    'conflict': 409,
  }[result.status];
  throw createError({ statusCode, message: result.reason });
});
