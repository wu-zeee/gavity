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

export const StartMeetingCommand = CommandBase.extend({
  type: z.literal('START_MEETING'),
  payload: z.object({}),
});

export const EndMeetingCommand = CommandBase.extend({
  type: z.literal('END_MEETING'),
  payload: z.object({}),
});

export const ResumeMeetingCommand = CommandBase.extend({
  type: z.literal('RESUME_MEETING'),
  payload: z.object({}),
});

export const GrabFloorCommand = CommandBase.extend({
  type: z.literal('GRAB_FLOOR'),
  payload: z.object({}),
});

export const ReleaseFloorCommand = CommandBase.extend({
  type: z.literal('RELEASE_FLOOR'),
  payload: z.object({}),
});

export const AssignFloorCommand = CommandBase.extend({
  type: z.literal('ASSIGN_FLOOR'),
  payload: z.object({
    seatId: z.string().min(1),
  }),
});

export const SwitchAgendaCommand = CommandBase.extend({
  type: z.literal('SWITCH_AGENDA'),
  payload: z.object({
    agendaItemId: z.int().positive(),
  }),
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
  StartMeetingCommand,
  EndMeetingCommand,
  ResumeMeetingCommand,
  GrabFloorCommand,
  ReleaseFloorCommand,
  AssignFloorCommand,
  SwitchAgendaCommand,
  ProposeMotionCommand,
  SecondMotionCommand,
  OpenVoteCommand,
  CastBallotCommand,
  CloseVoteCommand,
]);
export type MeetingCommand = z.infer<typeof MeetingCommand>;
