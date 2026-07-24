import * as z from 'zod';
import {
  ActiveVote,
  ActorRef,
  Ballot,
  Motion,
  VoteMethodMap,
  VoteTreshold,
} from './schemas';

const EventBase = z.object({
  version: z.literal(1),
  eventId: z.string().min(1),
  causationId: z.string().min(1),
  meetingId: z.int(),
  actor: ActorRef,
  occurredAt: z.int(),
});

export const MeetingStartedEvent = EventBase.extend({
  type: z.literal('MEETING_STARTED'),
  payload: z.object({}),
});

export const MeetingEndedEvent = EventBase.extend({
  type: z.literal('MEETING_ENDED'),
  payload: z.object({}),
});

export const MeetingResumedEvent = EventBase.extend({
  type: z.literal('MEETING_RESUMED'),
  payload: z.object({}),
});

export const FloorGrantedEvent = EventBase.extend({
  type: z.literal('FLOOR_GRANTED'),
  payload: z.object({
    seatId: z.string().min(1),
  }),
});

export const FloorReleasedEvent = EventBase.extend({
  type: z.literal('FLOOR_RELEASED'),
  payload: z.object({
    seatId: z.string().min(1),
    reopenAt: z.int(),
  }),
});

export const AgendaSwitchedEvent = EventBase.extend({
  type: z.literal('AGENDA_SWITCHED'),
  payload: z.object({
    agendaItemId: z.int().positive(),
  }),
});

export const SignedVoteResult = z.object({
  id: z.int(),
  threshold: VoteTreshold,
  voter: z.int(),
  method: z.literal(VoteMethodMap.SIGNED_BALLOT),
  passed: z.boolean(),
  yea: z.string().array(),
  nay: z.string().array(),
  abstain: z.string().array(),
  invalid: z.string().array(),
});
export type SignedVoteResult = z.infer<typeof SignedVoteResult>;

export const MotionProposedEvent = EventBase.extend({
  type: z.literal('MOTION_PROPOSED'),
  payload: z.object({ motion: Motion }),
});

export const MotionSecondedEvent = EventBase.extend({
  type: z.literal('MOTION_SECONDED'),
  payload: z.object({
    motionId: z.int(),
    seconderId: z.string(),
  }),
});

export const VoteOpenedEvent = EventBase.extend({
  type: z.literal('VOTE_OPENED'),
  payload: z.object({ vote: ActiveVote }),
});

export const BallotCastEvent = EventBase.extend({
  type: z.literal('BALLOT_CAST'),
  payload: z.object({
    voteId: z.int(),
    voterId: z.string(),
    ballot: Ballot,
  }),
});

const MotionDecidedPayload = z.object({
  motionId: z.int(),
  result: SignedVoteResult,
});

export const MotionPassedEvent = EventBase.extend({
  type: z.literal('MOTION_PASSED'),
  payload: MotionDecidedPayload,
});

export const MotionRejectedEvent = EventBase.extend({
  type: z.literal('MOTION_REJECTED'),
  payload: MotionDecidedPayload,
});

export const MeetingEvent = z.discriminatedUnion('type', [
  MeetingStartedEvent,
  MeetingEndedEvent,
  MeetingResumedEvent,
  FloorGrantedEvent,
  FloorReleasedEvent,
  AgendaSwitchedEvent,
  MotionProposedEvent,
  MotionSecondedEvent,
  VoteOpenedEvent,
  BallotCastEvent,
  MotionPassedEvent,
  MotionRejectedEvent,
]);
export type MeetingEvent = z.infer<typeof MeetingEvent>;
