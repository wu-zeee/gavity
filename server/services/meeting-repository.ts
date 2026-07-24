import type { MeetingEvent } from '../../shared/domain/events';
import type { DelegateMandate } from '../../shared/domain/mandate-policy';
import type { Meeting } from '../../shared/domain/schemas';

export interface StoredMeeting {
  organizationId: string
  state: Meeting
  version: number
}

export interface StoredParticipant {
  meetingId: number
  userId: string
  seatId: string
  role: 'chair' | 'member' | 'observer'
  attendanceMode: 'human' | 'delegate' | 'observer'
}

export interface SequencedMeetingEvent {
  sequence: number
  commandId: string
  event: MeetingEvent
}

export interface AppendMeetingEventsInput {
  meetingId: number
  commandId: string
  expectedVersion: number
  events: MeetingEvent[]
  nextState: Meeting
}

export type AppendMeetingEventsResult
  = | { status: 'appended', meeting: StoredMeeting }
    | { status: 'duplicate', meeting: StoredMeeting }
    | { status: 'conflict' };

export interface MeetingRepository {
  getMeeting: (meetingId: number) => Promise<StoredMeeting | null>
  getParticipant: (meetingId: number, userId: string) => Promise<StoredParticipant | null>
  getMandate: (mandateId: string) => Promise<DelegateMandate | null>
  hasCommand: (meetingId: number, commandId: string) => Promise<boolean>
  appendMeetingEvents: (input: AppendMeetingEventsInput) => Promise<AppendMeetingEventsResult>
  listEvents: (meetingId: number, afterSequence?: number) => Promise<SequencedMeetingEvent[]>
}

interface MemoryMeeting {
  meeting: StoredMeeting
  participants: Map<string, StoredParticipant>
  mandates: Map<string, DelegateMandate>
  events: SequencedMeetingEvent[]
  commandIds: Set<string>
}

/** 集成测试和本地服务测试使用；保持与 D1 仓储相同的幂等、版本语义。 */
export class InMemoryMeetingRepository implements MeetingRepository {
  private readonly meetings = new Map<number, MemoryMeeting>();

  seed(
    meeting: StoredMeeting,
    participants: StoredParticipant[],
    mandates: DelegateMandate[] = [],
  ): void {
    this.meetings.set(meeting.state.id, {
      meeting: structuredClone(meeting),
      participants: new Map(participants.map(participant => [participant.userId, structuredClone(participant)])),
      mandates: new Map(mandates.map(mandate => [mandate.id, structuredClone(mandate)])),
      events: [],
      commandIds: new Set(),
    });
  }

  async getMeeting(meetingId: number): Promise<StoredMeeting | null> {
    const record = this.meetings.get(meetingId);
    return record ? structuredClone(record.meeting) : null;
  }

  async getParticipant(meetingId: number, userId: string): Promise<StoredParticipant | null> {
    const participant = this.meetings.get(meetingId)?.participants.get(userId);
    return participant ? structuredClone(participant) : null;
  }

  async getMandate(mandateId: string): Promise<DelegateMandate | null> {
    for (const record of this.meetings.values()) {
      const mandate = record.mandates.get(mandateId);
      if (mandate)
        return structuredClone(mandate);
    }
    return null;
  }

  async hasCommand(meetingId: number, commandId: string): Promise<boolean> {
    return this.meetings.get(meetingId)?.commandIds.has(commandId) ?? false;
  }

  async appendMeetingEvents(input: AppendMeetingEventsInput): Promise<AppendMeetingEventsResult> {
    const record = this.meetings.get(input.meetingId);
    if (!record)
      return { status: 'conflict' };
    if (record.commandIds.has(input.commandId))
      return { status: 'duplicate', meeting: structuredClone(record.meeting) };
    if (record.meeting.version !== input.expectedVersion)
      return { status: 'conflict' };

    input.events.forEach((event, index) => {
      record.events.push({
        sequence: input.expectedVersion + index + 1,
        commandId: input.commandId,
        event: structuredClone(event),
      });
    });
    record.commandIds.add(input.commandId);
    record.meeting = {
      ...record.meeting,
      state: structuredClone(input.nextState),
      version: input.expectedVersion + input.events.length,
    };
    return { status: 'appended', meeting: structuredClone(record.meeting) };
  }

  async listEvents(meetingId: number, afterSequence = 0): Promise<SequencedMeetingEvent[]> {
    const events = this.meetings.get(meetingId)?.events ?? [];
    return structuredClone(events.filter(event => event.sequence > afterSequence));
  }
}
