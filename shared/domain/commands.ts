import * as z from 'zod';
import { ActorRef, Ballot, MotionType } from './schemas';

const CommandBase = z.object({
  version: z.literal(1),
  commandId: z.string().min(1),
  meetingId: z.int(),
  actor: ActorRef,
  /** 由可信调用方提供；未来服务端会覆盖客户端时间。 */
  issuedAt: z.int(),
});

export const ProposeMotionCommand = CommandBase.extend({
  type: z.literal('PROPOSE_MOTION'),
  payload: z.object({
    motionId: z.int().positive(),
    motionType: MotionType,
    content: z.string().min(1),
    details: z.string(),
  }),
});

export const SecondMotionCommand = CommandBase.extend({
  type: z.literal('SECOND_MOTION'),
  payload: z.object({
    motionId: z.int().positive(),
  }),
});

export const OpenVoteCommand = CommandBase.extend({
  type: z.literal('OPEN_VOTE'),
  payload: z.object({
    motionId: z.int().positive(),
    voteId: z.int().positive(),
    durationSeconds: z.int().positive(),
  }),
});

export const CastBallotCommand = CommandBase.extend({
  type: z.literal('CAST_BALLOT'),
  payload: z.object({
    ballot: Ballot,
  }),
});

export const CloseVoteCommand = CommandBase.extend({
  type: z.literal('CLOSE_VOTE'),
  payload: z.object({}),
});

export const MeetingCommand = z.discriminatedUnion('type', [
  ProposeMotionCommand,
  SecondMotionCommand,
  OpenVoteCommand,
  CastBallotCommand,
  CloseVoteCommand,
]);
export type MeetingCommand = z.infer<typeof MeetingCommand>;
