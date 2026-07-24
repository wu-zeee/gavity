import type { MeetingCommand } from '../../shared/domain/commands';
import type { DelegateMandate } from '../../shared/domain/mandate-policy';
import type { ActorRef, Meeting, Motion } from '../../shared/domain/schemas';
import { describe, expect, test } from 'bun:test';
import { applyMeetingEvents, decideMeetingCommand } from '../../shared/domain/meeting-machine';
import {
  ActorKindMap,
  BallotMap,
  MeetingStatusMap,
  MotionStatusMap,
  MotionTypeMap,
  VoteMethodMap,
  VoteTresholdMap,
} from '../../shared/domain/schemas';

const NOW = 1_750_000_000_000;

function human(userId: string): ActorRef {
  return {
    id: userId,
    seatId: userId,
    kind: ActorKindMap.HUMAN,
    mandateId: null,
  };
}

function createMeeting(patch: Partial<Meeting> = {}): Meeting {
  return {
    schema: 1,
    id: 1,
    profile: { title: '领域测试会议', chair: 'u1' },
    status: MeetingStatusMap.IN_PROGRESS,
    recordMode: false,
    floor: [],
    floorHolder: 'u2',
    floorGrabAt: null,
    members: ['u1', 'u2', 'u3'],
    observers: ['u4'],
    agenda: [],
    currentAgendaId: null,
    motions: [],
    votes: [],
    activeVote: null,
    voteDuration: 60,
    startedAt: NOW - 1000,
    ...patch,
  };
}

function pendingMotion(patch: Partial<Motion> = {}): Motion {
  return {
    id: 1,
    type: MotionTypeMap.MAIN,
    content: '通过年度预算',
    details: '',
    status: MotionStatusMap.PENDING,
    proposer: 'u2',
    seconders: ['u3'],
    createdAt: NOW - 500,
    voteId: null,
    ...patch,
  };
}

function proposeCommand(
  motionType = MotionTypeMap.MAIN,
  actor = human('u2'),
  motionId = 1,
): MeetingCommand {
  return {
    version: 1,
    commandId: `cmd-propose-${motionId}`,
    type: 'PROPOSE_MOTION',
    meetingId: 1,
    actor,
    issuedAt: NOW,
    payload: {
      motionId,
      motionType,
      content: '通过年度预算',
      details: '预算上限 12 万元',
    },
  };
}

function applyAccepted(meeting: Meeting, command: MeetingCommand): Meeting {
  const decision = decideMeetingCommand(meeting, command);
  expect(decision.status).toBe('accepted');
  if (decision.status !== 'accepted')
    throw new Error(`expected accepted command, got ${decision.status}`);
  return applyMeetingEvents(meeting, decision.events);
}

describe('主动议与附议', () => {
  test('持有发言权的成员可提出主动议，且输入状态保持不变', () => {
    const meeting = createMeeting();
    const decision = decideMeetingCommand(meeting, proposeCommand());

    expect(decision.status).toBe('accepted');
    expect(meeting.motions).toHaveLength(0);
    if (decision.status !== 'accepted')
      throw new Error('expected accepted command');

    const next = applyMeetingEvents(meeting, decision.events);
    expect(next.motions[0]).toMatchObject({
      id: 1,
      type: MotionTypeMap.MAIN,
      status: MotionStatusMap.DRAFT,
      proposer: 'u2',
    });
  });

  test('没有发言权时不能提出主动议', () => {
    const meeting = createMeeting({ floorHolder: 'u1' });
    const decision = decideMeetingCommand(meeting, proposeCommand());

    expect(decision).toMatchObject({
      status: 'rejected',
      reason: '该动议需要持有发言权才能提出',
    });
  });

  test('其他成员可附议，提出人不能附议自己的动议', () => {
    const draft = pendingMotion({
      status: MotionStatusMap.DRAFT,
      seconders: [],
    });
    const meeting = createMeeting({ motions: [draft] });
    const valid: MeetingCommand = {
      version: 1,
      commandId: 'cmd-second-valid',
      type: 'SECOND_MOTION',
      meetingId: 1,
      actor: human('u3'),
      issuedAt: NOW,
      payload: { motionId: 1 },
    };
    const invalid: MeetingCommand = {
      ...valid,
      commandId: 'cmd-second-invalid',
      actor: human('u2'),
    };

    const accepted = decideMeetingCommand(meeting, valid);
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted')
      throw new Error('expected accepted command');
    expect(applyMeetingEvents(meeting, accepted.events).motions[0]).toMatchObject({
      status: MotionStatusMap.PENDING,
      seconders: ['u3'],
    });
    expect(decideMeetingCommand(meeting, invalid)).toMatchObject({
      status: 'rejected',
      reason: '提出人不能附议自己的动议',
    });
  });
});

describe('修正与结束讨论', () => {
  test('活动主动议上可提出修正案，没有活动动议时不可提出', () => {
    const withMain = createMeeting({ motions: [pendingMotion()] });
    const valid = decideMeetingCommand(
      withMain,
      proposeCommand(MotionTypeMap.AMEND, human('u2'), 2),
    );
    expect(valid.status).toBe('accepted');
    if (valid.status !== 'accepted')
      throw new Error('expected accepted command');
    expect(applyMeetingEvents(withMain, valid.events).motions[1]).toMatchObject({
      type: MotionTypeMap.AMEND,
      status: MotionStatusMap.DRAFT,
    });

    const withoutMain = decideMeetingCommand(
      createMeeting(),
      proposeCommand(MotionTypeMap.AMEND, human('u2'), 2),
    );
    expect(withoutMain).toMatchObject({
      status: 'rejected',
      reason: '当前没有待处理的动议，无法提出附属动议',
    });
  });

  test('修正案通过后由领域投影更新主动议内容', () => {
    let state = createMeeting({ motions: [pendingMotion()] });
    state = applyAccepted(
      state,
      proposeCommand(MotionTypeMap.AMEND, human('u2'), 2),
    );
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-second-amendment',
      type: 'SECOND_MOTION',
      meetingId: 1,
      actor: human('u3'),
      issuedAt: NOW + 1,
      payload: { motionId: 2 },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-open-amendment',
      type: 'OPEN_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 2,
      payload: { motionId: 2, voteId: 1, durationSeconds: 60 },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-vote-amendment',
      type: 'CAST_BALLOT',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 3,
      payload: { ballot: BallotMap.YEA },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-close-amendment',
      type: 'CLOSE_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 4,
      payload: {},
    });

    expect(state.motions[0]?.content).toBe('通过年度预算（修正：通过年度预算）');
    expect(state.motions[1]).toMatchObject({
      status: MotionStatusMap.DISPOSED,
      voteId: 1,
    });
  });

  test('结束讨论通过后回到主动议并可立即开启其表决', () => {
    let state = createMeeting({ motions: [pendingMotion()] });
    state = applyAccepted(
      state,
      proposeCommand(MotionTypeMap.PREVIOUS_QUESTION, human('u2'), 2),
    );
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-second-previous-question',
      type: 'SECOND_MOTION',
      meetingId: 1,
      actor: human('u3'),
      issuedAt: NOW + 1,
      payload: { motionId: 2 },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-open-previous-question',
      type: 'OPEN_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 2,
      payload: { motionId: 2, voteId: 1, durationSeconds: 60 },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-vote-previous-question',
      type: 'CAST_BALLOT',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 3,
      payload: { ballot: BallotMap.YEA },
    });
    state = applyAccepted(state, {
      version: 1,
      commandId: 'cmd-close-previous-question',
      type: 'CLOSE_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 4,
      payload: {},
    });
    expect(state.motions[0]?.status).toBe(MotionStatusMap.PENDING);
    expect(state.motions[1]).toMatchObject({
      type: MotionTypeMap.PREVIOUS_QUESTION,
      status: MotionStatusMap.DISPOSED,
    });
    expect(decideMeetingCommand(state, {
      version: 1,
      commandId: 'cmd-open-main-after-debate',
      type: 'OPEN_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW + 5,
      payload: { motionId: 1, voteId: 2, durationSeconds: 60 },
    }).status).toBe('accepted');

    const rejected = decideMeetingCommand(
      createMeeting(),
      proposeCommand(MotionTypeMap.PREVIOUS_QUESTION, human('u2'), 2),
    );
    expect(rejected.status).toBe('rejected');
  });
});

describe('表决', () => {
  test('只有主持可开启表决，完整投票产生确定性结果', () => {
    const initial = createMeeting({
      floorHolder: null,
      motions: [pendingMotion()],
    });
    const open: MeetingCommand = {
      version: 1,
      commandId: 'cmd-open',
      type: 'OPEN_VOTE',
      meetingId: 1,
      actor: human('u1'),
      issuedAt: NOW,
      payload: { motionId: 1, voteId: 1, durationSeconds: 60 },
    };
    expect(decideMeetingCommand(initial, { ...open, actor: human('u2') })).toMatchObject({
      status: 'rejected',
      reason: '仅主持可开启投票',
    });

    const opened = decideMeetingCommand(initial, open);
    expect(opened.status).toBe('accepted');
    if (opened.status !== 'accepted')
      throw new Error('expected accepted command');
    let state = applyMeetingEvents(initial, opened.events);

    const ballots = [
      ['u1', BallotMap.YEA],
      ['u2', BallotMap.YEA],
      ['u3', BallotMap.NAY],
    ] as const;
    for (const [index, [userId, ballot]] of ballots.entries()) {
      const cast: MeetingCommand = {
        version: 1,
        commandId: `cmd-cast-${index}`,
        type: 'CAST_BALLOT',
        meetingId: 1,
        actor: human(userId),
        issuedAt: NOW + index + 1,
        payload: { ballot },
      };
      const castDecision = decideMeetingCommand(state, cast);
      expect(castDecision.status).toBe('accepted');
      if (castDecision.status !== 'accepted')
        throw new Error('expected accepted ballot');
      state = applyMeetingEvents(state, castDecision.events);
    }

    const close: MeetingCommand = {
      version: 1,
      commandId: 'cmd-close',
      type: 'CLOSE_VOTE',
      meetingId: 1,
      actor: {
        id: 'system',
        seatId: 'system',
        kind: ActorKindMap.SYSTEM,
        mandateId: null,
      },
      issuedAt: NOW + 10,
      payload: {},
    };
    const closed = decideMeetingCommand(state, close);
    expect(closed.status).toBe('accepted');
    if (closed.status !== 'accepted')
      throw new Error('expected accepted command');
    state = applyMeetingEvents(state, closed.events);

    expect(state.activeVote).toBeNull();
    expect(state.status).toBe(MeetingStatusMap.IN_PROGRESS);
    expect(state.motions[0]).toMatchObject({
      status: MotionStatusMap.DISPOSED,
      voteId: 1,
    });
    expect(state.votes[0]).toMatchObject({
      method: VoteMethodMap.SIGNED_BALLOT,
      threshold: VoteTresholdMap.MAJORITY,
      passed: true,
      yea: ['u1', 'u2'],
      nay: ['u3'],
    });
  });

  test('成员不能重复投票，观察员不能投票', () => {
    const meeting = createMeeting({
      status: MeetingStatusMap.VOTING,
      floorHolder: null,
      motions: [pendingMotion({ status: MotionStatusMap.VOTING })],
      activeVote: {
        id: 1,
        motionId: 1,
        threshold: VoteTresholdMap.MAJORITY,
        method: VoteMethodMap.SIGNED_BALLOT,
        ballots: { u2: BallotMap.YEA },
        startedAt: NOW,
        deadlineAt: NOW + 60_000,
      },
    });
    const cast = (actor: ActorRef): MeetingCommand => ({
      version: 1,
      commandId: `cmd-cast-${actor.id}`,
      type: 'CAST_BALLOT',
      meetingId: 1,
      actor,
      issuedAt: NOW + 1,
      payload: { ballot: BallotMap.YEA },
    });

    expect(decideMeetingCommand(meeting, cast(human('u2')))).toMatchObject({
      status: 'rejected',
      reason: '你已投过票',
    });
    expect(decideMeetingCommand(meeting, cast(human('u4')))).toMatchObject({
      status: 'rejected',
      reason: '观察员无表决权',
    });
  });
});

describe('数字代表授权', () => {
  test('授权内投票可执行，越过投票边界则请求真人确认', () => {
    const meeting = createMeeting({
      status: MeetingStatusMap.VOTING,
      floorHolder: null,
      motions: [pendingMotion({ status: MotionStatusMap.VOTING })],
      activeVote: {
        id: 1,
        motionId: 1,
        threshold: VoteTresholdMap.MAJORITY,
        method: VoteMethodMap.SIGNED_BALLOT,
        ballots: {},
        startedAt: NOW,
        deadlineAt: NOW + 60_000,
      },
    });
    const delegate: ActorRef = {
      id: 'agent-u2',
      seatId: 'u2',
      kind: ActorKindMap.DELEGATE,
      mandateId: 'mandate-u2',
    };
    const mandate: DelegateMandate = {
      id: 'mandate-u2',
      principalId: 'u2',
      delegateId: 'agent-u2',
      meetingId: 1,
      agendaItemIds: [],
      actions: ['vote'],
      requiresConfirmation: [],
      allowedBallots: [BallotMap.YEA],
      effectiveAt: NOW - 1000,
      expiresAt: NOW + 60_000,
      revokedAt: null,
    };
    const command = (ballot: typeof BallotMap.YEA | typeof BallotMap.NAY): MeetingCommand => ({
      version: 1,
      commandId: `cmd-delegate-${ballot}`,
      type: 'CAST_BALLOT',
      meetingId: 1,
      actor: delegate,
      issuedAt: NOW,
      payload: { ballot },
    });

    expect(decideMeetingCommand(meeting, command(BallotMap.YEA), { mandate }).status).toBe('accepted');
    expect(decideMeetingCommand(meeting, command(BallotMap.NAY), { mandate })).toMatchObject({
      status: 'requires-approval',
      reason: '该票超出数字代表的投票边界',
    });
    expect(decideMeetingCommand(meeting, command(BallotMap.YEA))).toMatchObject({
      status: 'requires-approval',
      reason: '数字代表缺少可验证的授权依据',
    });
  });
});
