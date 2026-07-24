import type { MeetingCommand } from './commands';
import type { MeetingEvent, SignedVoteResult } from './events';
import type { DelegateMandate, MandateAction } from './mandate-policy';
import type { Meeting, Motion, VoteTreshold } from './schemas';
import { MeetingCommand as MeetingCommandSchema } from './commands';
import { evaluateMandate, MandateActionMap } from './mandate-policy';
import {
  canAssignFloor,
  canCastBallot,
  canEndFloor,
  canEndMeeting,
  canGrabFloor,
  canOpenVote,
  canProposeMotion,
  canResumeMeeting,
  canSecondMotion,
  canStartMeeting,
  canSwitchAgenda,
  isChair,
  isMember,
  laidAsideMotions,
  motionMeta,
  topMotion,
} from './parliamentary-rules';
import {
  ActorKindMap,
  BallotMap,
  MeetingStatusMap,
  MotionStatusMap,
  MotionTypeMap,
  VoteMethodMap,
  VoteTresholdMap,
} from './schemas';

export type CommandDecision
  = | { status: 'accepted', events: MeetingEvent[] }
    | { status: 'rejected', reason: string }
    | { status: 'requires-approval', reason: string };

export interface CommandContext {
  mandate?: DelegateMandate
}

function reject(reason: string): CommandDecision {
  return { status: 'rejected', reason };
}

function eventBase(command: MeetingCommand) {
  return {
    version: 1 as const,
    eventId: `${command.commandId}:0`,
    causationId: command.commandId,
    meetingId: command.meetingId,
    actor: command.actor,
    occurredAt: command.issuedAt,
  };
}

function mandateAction(command: MeetingCommand): MandateAction {
  switch (command.type) {
    case 'PROPOSE_MOTION':
      return MandateActionMap.PROPOSE;
    case 'SECOND_MOTION':
      return MandateActionMap.SECOND;
    case 'CAST_BALLOT':
      return MandateActionMap.VOTE;
    default:
      return MandateActionMap.FACILITATE;
  }
}

function motionById(meeting: Meeting, id: number): Motion | undefined {
  return meeting.motions.find(motion => motion.id === id);
}

function commandAgendaId(meeting: Meeting): number | null {
  return meeting.currentAgendaId;
}

function applyPassedMotionEffect(meeting: Meeting, motion: Motion): void {
  const target = topMotion(meeting);
  switch (motion.type) {
    case MotionTypeMap.LAY_ON_TABLE:
    case MotionTypeMap.POSTPONE_TO_TIME:
    case MotionTypeMap.REFER_TO_COMMITTEE:
      if (target)
        target.status = MotionStatusMap.LAID_ASIDE;
      break;
    case MotionTypeMap.POSTPONE_INDEFINITELY:
      if (target)
        target.status = MotionStatusMap.DISPOSED;
      break;
    case MotionTypeMap.AMEND:
      if (target)
        target.content = `${target.content}（修正：${motion.content}）`;
      break;
    case MotionTypeMap.TAKE_FROM_TABLE: {
      const laidAside = laidAsideMotions(meeting);
      const restored = laidAside[laidAside.length - 1];
      if (restored)
        restored.status = MotionStatusMap.PENDING;
      break;
    }
    case MotionTypeMap.ADJOURN:
      meeting.status = MeetingStatusMap.ENDED;
      meeting.activeVote = null;
      meeting.floor = [];
      meeting.floorHolder = null;
      for (const activeMotion of meeting.motions) {
        if (activeMotion.status !== MotionStatusMap.DISPOSED
          && activeMotion.status !== MotionStatusMap.LAID_ASIDE) {
          activeMotion.status = MotionStatusMap.DISPOSED;
        }
      }
      break;
    case MotionTypeMap.RECESS:
      meeting.status = MeetingStatusMap.RECESSED;
      meeting.floor = [];
      meeting.floorHolder = null;
      break;
  }
}

export function hasVotePassed(threshold: VoteTreshold, yea: number, nay: number): boolean {
  switch (threshold) {
    case VoteTresholdMap.TWO_THIRDS:
      return yea * 3 >= (yea + nay) * 2 && yea > 0;
    case VoteTresholdMap.UNANIMOUS:
      return nay === 0 && yea > 0;
    default:
      return yea > nay;
  }
}

/** 验证命令并只返回领域事件；本函数不修改传入状态。 */
export function decideMeetingCommand(
  meeting: Meeting,
  input: MeetingCommand,
  context: CommandContext = {},
): CommandDecision {
  const parsed = MeetingCommandSchema.safeParse(input);
  if (!parsed.success)
    return reject('命令结构无效');
  const command = parsed.data;

  if (command.meetingId !== meeting.id)
    return reject('命令不属于当前会议');
  if (command.actor.kind === ActorKindMap.SYSTEM && command.type !== 'CLOSE_VOTE')
    return reject('系统身份不能执行该会议动作');
  if (command.actor.kind === ActorKindMap.CHAIR_AGENT
    && command.type !== 'START_MEETING'
    && command.type !== 'END_MEETING'
    && command.type !== 'RESUME_MEETING'
    && command.type !== 'ASSIGN_FLOOR'
    && command.type !== 'SWITCH_AGENDA'
    && command.type !== 'OPEN_VOTE'
    && command.type !== 'CLOSE_VOTE') {
    return reject('AI 主持人不能代表成员提出动议、附议或投票');
  }

  const authorization = evaluateMandate(command.actor, {
    action: mandateAction(command),
    meetingId: command.meetingId,
    agendaItemId: commandAgendaId(meeting),
    at: command.issuedAt,
    ballot: command.type === 'CAST_BALLOT' ? command.payload.ballot : undefined,
  }, context.mandate);
  if (authorization.status === 'requires-approval')
    return { status: 'requires-approval', reason: authorization.reason };
  if (authorization.status === 'denied')
    return reject(authorization.reason);

  const actorSeatId = command.actor.seatId;
  const base = eventBase(command);

  switch (command.type) {
    case 'START_MEETING': {
      const check = canStartMeeting(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{ ...base, type: 'MEETING_STARTED', payload: {} }],
      };
    }

    case 'END_MEETING': {
      const check = canEndMeeting(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{ ...base, type: 'MEETING_ENDED', payload: {} }],
      };
    }

    case 'RESUME_MEETING': {
      const check = canResumeMeeting(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{ ...base, type: 'MEETING_RESUMED', payload: {} }],
      };
    }

    case 'GRAB_FLOOR': {
      const check = canGrabFloor(meeting, actorSeatId, command.issuedAt);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{ ...base, type: 'FLOOR_GRANTED', payload: { seatId: actorSeatId } }],
      };
    }

    case 'RELEASE_FLOOR': {
      const check = canEndFloor(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: 'FLOOR_RELEASED',
          payload: { seatId: meeting.floorHolder!, reopenAt: command.issuedAt + 3_000 },
        }],
      };
    }

    case 'ASSIGN_FLOOR': {
      const check = canAssignFloor(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      if (!isMember(meeting, command.payload.seatId))
        return reject('只能把发言权分配给会议成员');
      return {
        status: 'accepted',
        events: [{ ...base, type: 'FLOOR_GRANTED', payload: { seatId: command.payload.seatId } }],
      };
    }

    case 'SWITCH_AGENDA': {
      const check = canSwitchAgenda(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      if (!meeting.agenda.some(item => item.id === command.payload.agendaItemId))
        return reject('议题不存在');
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: 'AGENDA_SWITCHED',
          payload: { agendaItemId: command.payload.agendaItemId },
        }],
      };
    }

    case 'PROPOSE_MOTION': {
      if (!command.payload.content.trim())
        return reject('动议内容不能为空');
      if (motionById(meeting, command.payload.motionId))
        return reject('动议编号已存在');
      const check = canProposeMotion(meeting, actorSeatId, command.payload.motionType);
      if (!check.ok)
        return reject(check.reason!);
      const meta = motionMeta(command.payload.motionType);
      const motion: Motion = {
        id: command.payload.motionId,
        type: command.payload.motionType,
        content: command.payload.content.trim(),
        details: command.payload.details.trim(),
        status: meta.needsSecond ? MotionStatusMap.DRAFT : MotionStatusMap.PENDING,
        proposer: actorSeatId,
        seconders: [],
        createdAt: command.issuedAt,
        voteId: null,
      };
      return {
        status: 'accepted',
        events: [{ ...base, type: 'MOTION_PROPOSED', payload: { motion } }],
      };
    }

    case 'SECOND_MOTION': {
      const motion = motionById(meeting, command.payload.motionId);
      if (!motion)
        return reject('动议不存在');
      const check = canSecondMotion(meeting, actorSeatId, motion);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: 'MOTION_SECONDED',
          payload: { motionId: motion.id, seconderId: actorSeatId },
        }],
      };
    }

    case 'OPEN_VOTE': {
      const motion = motionById(meeting, command.payload.motionId);
      if (!motion)
        return reject('动议不存在');
      if (meeting.activeVote)
        return reject('已有进行中的投票');
      if (meeting.votes.some(vote => vote.id === command.payload.voteId))
        return reject('投票编号已存在');
      const check = canOpenVote(meeting, actorSeatId, motion);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: 'VOTE_OPENED',
          payload: {
            vote: {
              id: command.payload.voteId,
              motionId: motion.id,
              threshold: motionMeta(motion.type).threshold,
              method: VoteMethodMap.SIGNED_BALLOT,
              ballots: {},
              startedAt: command.issuedAt,
              deadlineAt: command.issuedAt + command.payload.durationSeconds * 1000,
            },
          },
        }],
      };
    }

    case 'CAST_BALLOT': {
      const check = canCastBallot(meeting, actorSeatId);
      if (!check.ok)
        return reject(check.reason!);
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: 'BALLOT_CAST',
          payload: {
            voteId: meeting.activeVote!.id,
            voterId: actorSeatId,
            ballot: command.payload.ballot,
          },
        }],
      };
    }

    case 'CLOSE_VOTE': {
      const vote = meeting.activeVote;
      if (!vote)
        return reject('当前没有进行中的投票');
      const allBallotsCast = Object.keys(vote.ballots).length >= meeting.members.length;
      if (command.actor.kind === ActorKindMap.SYSTEM) {
        if (!allBallotsCast && command.issuedAt < vote.deadlineAt)
          return reject('投票尚未到截止时间');
      } else if (!meeting.recordMode && !isChair(meeting, actorSeatId)) {
        return reject('仅主持可提前结束投票');
      }

      const yea: string[] = [];
      const nay: string[] = [];
      const abstain: string[] = [];
      for (const [userId, ballot] of Object.entries(vote.ballots)) {
        if (ballot === BallotMap.YEA)
          yea.push(userId);
        else if (ballot === BallotMap.NAY)
          nay.push(userId);
        else
          abstain.push(userId);
      }
      const passed = hasVotePassed(vote.threshold, yea.length, nay.length);
      const result: SignedVoteResult = {
        id: vote.id,
        threshold: vote.threshold,
        voter: meeting.members.length,
        method: VoteMethodMap.SIGNED_BALLOT,
        passed,
        yea,
        nay,
        abstain,
        invalid: [],
      };
      return {
        status: 'accepted',
        events: [{
          ...base,
          type: passed ? 'MOTION_PASSED' : 'MOTION_REJECTED',
          payload: { motionId: vote.motionId, result },
        }],
      };
    }
  }
}

/** 将事件投影为新状态；输入对象保持不变。 */
export function applyMeetingEvents(meeting: Meeting, events: MeetingEvent[]): Meeting {
  const next = structuredClone(meeting);
  for (const event of events) {
    switch (event.type) {
      case 'MEETING_STARTED':
        next.status = MeetingStatusMap.IN_PROGRESS;
        next.startedAt = event.occurredAt;
        break;
      case 'MEETING_ENDED':
        next.status = MeetingStatusMap.ENDED;
        next.activeVote = null;
        next.floor = [];
        next.floorHolder = null;
        for (const motion of next.motions) {
          if (motion.status !== MotionStatusMap.DISPOSED
            && motion.status !== MotionStatusMap.LAID_ASIDE) {
            motion.status = MotionStatusMap.DISPOSED;
          }
        }
        break;
      case 'MEETING_RESUMED':
        next.status = MeetingStatusMap.IN_PROGRESS;
        break;
      case 'FLOOR_GRANTED':
        next.floor = [];
        next.floorHolder = event.payload.seatId;
        next.floorGrabAt = null;
        break;
      case 'FLOOR_RELEASED':
        next.floor = [];
        next.floorHolder = null;
        next.floorGrabAt = event.payload.reopenAt;
        break;
      case 'AGENDA_SWITCHED':
        next.currentAgendaId = event.payload.agendaItemId;
        break;
      case 'MOTION_PROPOSED':
        next.motions.push(structuredClone(event.payload.motion));
        break;
      case 'MOTION_SECONDED': {
        const motion = motionById(next, event.payload.motionId);
        if (!motion)
          throw new Error(`Cannot apply MOTION_SECONDED: motion ${event.payload.motionId} does not exist`);
        motion.seconders.push(event.payload.seconderId);
        motion.status = MotionStatusMap.PENDING;
        break;
      }
      case 'VOTE_OPENED': {
        const motion = motionById(next, event.payload.vote.motionId);
        if (!motion)
          throw new Error(`Cannot apply VOTE_OPENED: motion ${event.payload.vote.motionId} does not exist`);
        motion.status = MotionStatusMap.VOTING;
        next.status = MeetingStatusMap.VOTING;
        next.activeVote = structuredClone(event.payload.vote);
        break;
      }
      case 'BALLOT_CAST':
        if (!next.activeVote || next.activeVote.id !== event.payload.voteId)
          throw new Error(`Cannot apply BALLOT_CAST: vote ${event.payload.voteId} is not active`);
        next.activeVote.ballots[event.payload.voterId] = event.payload.ballot;
        break;
      case 'MOTION_PASSED':
      case 'MOTION_REJECTED': {
        const motion = motionById(next, event.payload.motionId);
        next.votes.push(structuredClone(event.payload.result));
        next.activeVote = null;
        next.status = MeetingStatusMap.IN_PROGRESS;
        if (motion) {
          motion.status = MotionStatusMap.DISPOSED;
          motion.voteId = event.payload.result.id;
          if (event.type === 'MOTION_PASSED')
            applyPassedMotionEffect(next, motion);
        }
        break;
      }
    }
  }
  return next;
}
