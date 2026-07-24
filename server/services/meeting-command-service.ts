import type { ClientMeetingCommand as ClientMeetingCommandType } from '../../shared/contracts/meetings';
import type { MeetingCommand } from '../../shared/domain/commands';
import type { MeetingEvent } from '../../shared/domain/events';
import type { MeetingRepository, StoredMeeting } from './meeting-repository';
import { ClientMeetingCommand } from '../../shared/contracts/meetings';
import { applyMeetingEvents, decideMeetingCommand } from '../../shared/domain/meeting-machine';
import { ActorKindMap } from '../../shared/domain/schemas';

export type MeetingCommandResult
  = | {
    status: 'accepted'
    duplicate: boolean
    events: MeetingEvent[]
    meeting: StoredMeeting
  }
  | {
    status: 'rejected' | 'requires-approval' | 'invalid' | 'not-found' | 'forbidden' | 'conflict'
    reason: string
  };

export interface ExecuteMeetingCommandInput {
  userId: string
  command: ClientMeetingCommandType | unknown
  now?: number
}

export class MeetingCommandService {
  constructor(private readonly repository: MeetingRepository) {}

  async execute(input: ExecuteMeetingCommandInput): Promise<MeetingCommandResult> {
    const parsed = ClientMeetingCommand.safeParse(input.command);
    if (!parsed.success)
      return { status: 'invalid', reason: '命令结构无效' };
    const clientCommand = parsed.data;

    if (await this.repository.hasCommand(clientCommand.meetingId, clientCommand.commandId)) {
      const meeting = await this.repository.getMeeting(clientCommand.meetingId);
      if (!meeting)
        return { status: 'not-found', reason: '会议不存在' };
      return { status: 'accepted', duplicate: true, events: [], meeting };
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const stored = await this.repository.getMeeting(clientCommand.meetingId);
      if (!stored)
        return { status: 'not-found', reason: '会议不存在' };

      const participant = await this.repository.getParticipant(clientCommand.meetingId, input.userId);
      if (!participant)
        return { status: 'forbidden', reason: '当前用户不是本次会议参与者' };
      if (participant.attendanceMode !== 'human')
        return { status: 'forbidden', reason: '当前席位未以真人方式出席' };

      const command = {
        ...clientCommand,
        actor: {
          id: input.userId,
          seatId: participant.seatId,
          kind: ActorKindMap.HUMAN,
          mandateId: null,
        },
        issuedAt: input.now ?? Date.now(),
      } as MeetingCommand;
      const decision = decideMeetingCommand(stored.state, command);
      if (decision.status !== 'accepted')
        return decision;

      const nextState = applyMeetingEvents(stored.state, decision.events);
      const appended = await this.repository.appendMeetingEvents({
        meetingId: clientCommand.meetingId,
        commandId: clientCommand.commandId,
        expectedVersion: stored.version,
        events: decision.events,
        nextState,
      });
      if (appended.status === 'appended') {
        return {
          status: 'accepted',
          duplicate: false,
          events: decision.events,
          meeting: appended.meeting,
        };
      }
      if (appended.status === 'duplicate') {
        return {
          status: 'accepted',
          duplicate: true,
          events: [],
          meeting: appended.meeting,
        };
      }
    }

    return { status: 'conflict', reason: '会议状态已变化，请刷新后重试' };
  }
}
