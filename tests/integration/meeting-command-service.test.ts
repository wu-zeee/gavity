import type { Meeting } from '../../shared/domain/schemas';
import { describe, expect, test } from 'bun:test';
import { MeetingCommandService } from '../../server/services/meeting-command-service';
import { InMemoryMeetingRepository } from '../../server/services/meeting-repository';
import { applyMeetingEvents } from '../../shared/domain/meeting-machine';
import {
  MeetingStatusMap,
  MotionStatusMap,
  MotionTypeMap,
} from '../../shared/domain/schemas';

const NOW = 1_750_000_000_000;

function createMeeting(): Meeting {
  return {
    schema: 1,
    id: 7,
    profile: { title: '阶段三集成测试会议', chair: 'u1' },
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
    startedAt: NOW - 1_000,
  };
}

function createRepository() {
  const repository = new InMemoryMeetingRepository();
  repository.seed(
    {
      organizationId: 'org-1',
      state: createMeeting(),
      version: 0,
    },
    [
      { meetingId: 7, userId: 'u1', seatId: 'u1', role: 'chair', attendanceMode: 'human' },
      { meetingId: 7, userId: 'u2', seatId: 'u2', role: 'member', attendanceMode: 'human' },
      { meetingId: 7, userId: 'u3', seatId: 'u3', role: 'member', attendanceMode: 'human' },
      { meetingId: 7, userId: 'u4', seatId: 'u4', role: 'observer', attendanceMode: 'observer' },
    ],
  );
  return repository;
}

function proposeCommand(commandId = 'command-propose-001') {
  return {
    version: 1 as const,
    commandId,
    meetingId: 7,
    type: 'PROPOSE_MOTION' as const,
    payload: {
      motionId: 1,
      motionType: MotionTypeMap.MAIN,
      content: '通过 Maker Festival 设备预算',
      details: '预算上限 12,000 元',
    },
  };
}

describe('服务端权威会议命令', () => {
  test('服务端从会话用户构造 actor，客户端伪造 actor 会被结构校验拒绝', async () => {
    const repository = createRepository();
    const service = new MeetingCommandService(repository);
    const forged = {
      ...proposeCommand(),
      actor: {
        id: 'u1',
        seatId: 'u1',
        kind: 'human',
        mandateId: null,
      },
      issuedAt: NOW - 99_999,
    };

    expect(await service.execute({ userId: 'u2', command: forged, now: NOW })).toEqual({
      status: 'invalid',
      reason: '命令结构无效',
    });

    const result = await service.execute({
      userId: 'u2',
      command: proposeCommand(),
      now: NOW,
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted')
      throw new Error('expected accepted result');
    expect(result.events[0]?.actor).toMatchObject({
      id: 'u2',
      seatId: 'u2',
      kind: 'human',
    });
  });

  test('非参与者和观察员不能借用成员身份执行动作', async () => {
    const service = new MeetingCommandService(createRepository());
    expect(await service.execute({
      userId: 'outsider',
      command: proposeCommand(),
      now: NOW,
    })).toEqual({
      status: 'forbidden',
      reason: '当前用户不是本次会议参与者',
    });
    expect(await service.execute({
      userId: 'u4',
      command: proposeCommand(),
      now: NOW,
    })).toEqual({
      status: 'forbidden',
      reason: '当前席位未以真人方式出席',
    });
  });

  test('相同幂等键重复提交不会重复产生事件', async () => {
    const repository = createRepository();
    const service = new MeetingCommandService(repository);
    const first = await service.execute({
      userId: 'u2',
      command: proposeCommand(),
      now: NOW,
    });
    const duplicate = await service.execute({
      userId: 'u2',
      command: proposeCommand(),
      now: NOW + 100,
    });

    expect(first).toMatchObject({ status: 'accepted', duplicate: false });
    expect(duplicate).toMatchObject({ status: 'accepted', duplicate: true, events: [] });
    expect(await repository.listEvents(7)).toHaveLength(1);
    expect((await repository.getMeeting(7))?.state.motions).toHaveLength(1);
  });

  test('重新创建应用服务后可从仓储恢复，事件回放与当前投影一致', async () => {
    const repository = createRepository();
    const firstService = new MeetingCommandService(repository);
    const proposed = await firstService.execute({
      userId: 'u2',
      command: proposeCommand(),
      now: NOW,
    });
    expect(proposed.status).toBe('accepted');

    const secondService = new MeetingCommandService(repository);
    const seconded = await secondService.execute({
      userId: 'u3',
      command: {
        version: 1,
        commandId: 'command-second-001',
        meetingId: 7,
        type: 'SECOND_MOTION',
        payload: { motionId: 1 },
      },
      now: NOW + 1,
    });
    expect(seconded.status).toBe('accepted');

    const events = await repository.listEvents(7);
    const replayed = applyMeetingEvents(createMeeting(), events.map(item => item.event));
    const restored = await repository.getMeeting(7);
    expect(restored?.version).toBe(2);
    expect(restored?.state).toEqual(replayed);
    expect(restored?.state.motions[0]).toMatchObject({
      status: MotionStatusMap.PENDING,
      seconders: ['u3'],
    });
  });
});
