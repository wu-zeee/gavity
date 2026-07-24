import * as z from 'zod';
import { Ballot, MotionType } from '../domain/schemas';

const ClientCommandBase = z.strictObject({
  version: z.literal(1),
  commandId: z.string().min(8).max(160),
  meetingId: z.int().positive(),
});

export const ClientMeetingCommand = z.discriminatedUnion('type', [
  ClientCommandBase.extend({
    type: z.literal('START_MEETING'),
    payload: z.strictObject({}),
  }),
  ClientCommandBase.extend({
    type: z.literal('END_MEETING'),
    payload: z.strictObject({}),
  }),
  ClientCommandBase.extend({
    type: z.literal('RESUME_MEETING'),
    payload: z.strictObject({}),
  }),
  ClientCommandBase.extend({
    type: z.literal('GRAB_FLOOR'),
    payload: z.strictObject({}),
  }),
  ClientCommandBase.extend({
    type: z.literal('RELEASE_FLOOR'),
    payload: z.strictObject({}),
  }),
  ClientCommandBase.extend({
    type: z.literal('ASSIGN_FLOOR'),
    payload: z.strictObject({
      seatId: z.string().min(1),
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('SWITCH_AGENDA'),
    payload: z.strictObject({
      agendaItemId: z.int().positive(),
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('PROPOSE_MOTION'),
    payload: z.strictObject({
      motionId: z.int().positive(),
      motionType: MotionType,
      content: z.string().trim().min(1).max(4_000),
      details: z.string().trim().max(12_000),
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('SECOND_MOTION'),
    payload: z.strictObject({
      motionId: z.int().positive(),
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('OPEN_VOTE'),
    payload: z.strictObject({
      motionId: z.int().positive(),
      voteId: z.int().positive(),
      durationSeconds: z.int().min(10).max(3_600),
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('CAST_BALLOT'),
    payload: z.strictObject({
      ballot: Ballot,
    }),
  }),
  ClientCommandBase.extend({
    type: z.literal('CLOSE_VOTE'),
    payload: z.strictObject({}),
  }),
]);
export type ClientMeetingCommand = z.infer<typeof ClientMeetingCommand>;

export const CreateOrganizationInput = z.strictObject({
  name: z.string().trim().min(2).max(120),
});

export const AddOrganizationMemberInput = z.strictObject({
  userId: z.string().min(1),
  role: z.enum(['member', 'observer']),
});

export const CreateMeetingInput = z.strictObject({
  organizationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  voteDuration: z.int().min(10).max(3_600).default(60),
  agenda: z.array(z.strictObject({
    title: z.string().trim().min(1).max(240),
    details: z.string().trim().max(12_000).default(''),
    scheduledAt: z.int().nullable().default(null),
    isSpecial: z.boolean().default(false),
  })).min(1).max(100),
});

export const CreateMandateInput = z.strictObject({
  delegateId: z.string().min(1),
  agendaItemIds: z.array(z.int().positive()).max(100),
  actions: z.array(z.enum(['propose', 'second', 'vote', 'facilitate'])).min(1),
  requiresConfirmation: z.array(z.enum(['propose', 'second', 'vote', 'facilitate'])).default([]),
  allowedBallots: z.array(Ballot).nullable().default(null),
  goal: z.string().trim().max(2_000).default(''),
  preferences: z.string().trim().max(4_000).default(''),
  prohibitions: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  effectiveAt: z.int(),
  expiresAt: z.int(),
});
