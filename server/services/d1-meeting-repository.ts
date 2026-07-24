import type { MeetingEvent } from '../../shared/domain/events';
import type { DelegateMandate } from '../../shared/domain/mandate-policy';
import type {
  AppendMeetingEventsInput,
  AppendMeetingEventsResult,
  MeetingRepository,
  SequencedMeetingEvent,
  StoredMeeting,
  StoredParticipant,
} from './meeting-repository';
import { MeetingEvent as MeetingEventSchema } from '../../shared/domain/events';
import { DelegateMandate as DelegateMandateSchema } from '../../shared/domain/mandate-policy';
import { MeetingState } from '../../shared/domain/schemas';

interface ProjectionRow {
  organization_id: string
  version: number
  state_json: string
}

interface ParticipantRow {
  meeting_id: number
  user_id: string
  seat_id: string
  role: StoredParticipant['role']
  attendance_mode: StoredParticipant['attendanceMode']
}

interface MandateRow {
  id: string
  principal_id: string
  delegate_id: string
  meeting_id: number
  agenda_item_ids: string
  actions: string
  requires_confirmation: string
  allowed_ballots: string | null
  effective_at: number
  expires_at: number
  revoked_at: number | null
}

interface EventRow {
  sequence: number
  command_id: string
  event_json: string
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error
    && (error.message.includes('UNIQUE constraint failed')
      || error.message.includes('constraint failed'));
}

export class D1MeetingRepository implements MeetingRepository {
  constructor(private readonly database: D1Database) {}

  async getMeeting(meetingId: number): Promise<StoredMeeting | null> {
    const row = await this.database.prepare(`
      SELECT m.organization_id, p.version, p.state_json
      FROM meeting_projections p
      JOIN meetings m ON m.id = p.meeting_id
      WHERE p.meeting_id = ?
    `).bind(meetingId).first<ProjectionRow>();
    if (!row)
      return null;
    const state = MeetingState.parse(JSON.parse(row.state_json));
    return {
      organizationId: row.organization_id,
      state,
      version: row.version,
    };
  }

  async getParticipant(meetingId: number, userId: string): Promise<StoredParticipant | null> {
    const row = await this.database.prepare(`
      SELECT meeting_id, user_id, seat_id, role, attendance_mode
      FROM meeting_participants
      WHERE meeting_id = ? AND user_id = ?
    `).bind(meetingId, userId).first<ParticipantRow>();
    if (!row)
      return null;
    return {
      meetingId: row.meeting_id,
      userId: row.user_id,
      seatId: row.seat_id,
      role: row.role,
      attendanceMode: row.attendance_mode,
    };
  }

  async getMandate(mandateId: string): Promise<DelegateMandate | null> {
    const row = await this.database.prepare(`
      SELECT id, principal_id, delegate_id, meeting_id, agenda_item_ids, actions,
        requires_confirmation, allowed_ballots, effective_at, expires_at, revoked_at
      FROM delegate_mandates
      WHERE id = ?
    `).bind(mandateId).first<MandateRow>();
    if (!row)
      return null;
    return DelegateMandateSchema.parse({
      id: row.id,
      principalId: row.principal_id,
      delegateId: row.delegate_id,
      meetingId: row.meeting_id,
      agendaItemIds: JSON.parse(row.agenda_item_ids),
      actions: JSON.parse(row.actions),
      requiresConfirmation: JSON.parse(row.requires_confirmation),
      allowedBallots: row.allowed_ballots ? JSON.parse(row.allowed_ballots) : null,
      effectiveAt: row.effective_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    });
  }

  async hasCommand(meetingId: number, commandId: string): Promise<boolean> {
    const row = await this.database.prepare(`
      SELECT 1 AS found
      FROM meeting_events
      WHERE meeting_id = ? AND command_id = ?
      LIMIT 1
    `).bind(meetingId, commandId).first<{ found: number }>();
    return row?.found === 1;
  }

  async appendMeetingEvents(input: AppendMeetingEventsInput): Promise<AppendMeetingEventsResult> {
    const statements = input.events.map((event, index) => this.insertEventStatement(
      input,
      event,
      input.expectedVersion + index + 1,
    ));
    statements.push(this.database.prepare(`
      UPDATE meeting_projections
      SET version = ?, state_json = ?, updated_at = ?
      WHERE meeting_id = ? AND version = ?
    `).bind(
      input.expectedVersion + input.events.length,
      JSON.stringify(input.nextState),
      Date.now(),
      input.meetingId,
      input.expectedVersion,
    ));
    statements.push(this.database.prepare(`
      UPDATE meetings
      SET title = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      input.nextState.profile.title,
      input.nextState.status,
      Date.now(),
      input.meetingId,
    ));

    try {
      const results = await this.database.batch(statements);
      const projectionUpdate = results.at(-2);
      if (!projectionUpdate?.success || projectionUpdate.meta.changes !== 1)
        return { status: 'conflict' };
      const meeting = await this.getMeeting(input.meetingId);
      if (!meeting)
        return { status: 'conflict' };
      return { status: 'appended', meeting };
    } catch (error) {
      if (!isConstraintError(error))
        throw error;
      const meeting = await this.getMeeting(input.meetingId);
      if (meeting && await this.hasCommand(input.meetingId, input.commandId))
        return { status: 'duplicate', meeting };
      return { status: 'conflict' };
    }
  }

  async listEvents(meetingId: number, afterSequence = 0): Promise<SequencedMeetingEvent[]> {
    const result = await this.database.prepare(`
      SELECT sequence, command_id, event_json
      FROM meeting_events
      WHERE meeting_id = ? AND sequence > ?
      ORDER BY sequence ASC
    `).bind(meetingId, afterSequence).all<EventRow>();
    return result.results.map(row => ({
      sequence: row.sequence,
      commandId: row.command_id,
      event: MeetingEventSchema.parse(JSON.parse(row.event_json)),
    }));
  }

  private insertEventStatement(
    input: AppendMeetingEventsInput,
    event: MeetingEvent,
    sequence: number,
  ): D1PreparedStatement {
    return this.database.prepare(`
      INSERT INTO meeting_events (
        id, meeting_id, sequence, command_id, type, version,
        actor_id, actor_kind, seat_id, mandate_id, event_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.eventId,
      input.meetingId,
      sequence,
      input.commandId,
      event.type,
      event.version,
      event.actor.id,
      event.actor.kind,
      event.actor.seatId,
      event.actor.mandateId,
      JSON.stringify(event),
      event.occurredAt,
    );
  }
}
