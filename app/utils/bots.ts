import { BallotMap, MotionStatusMap } from '#shared/utils/mettings';
import { castBallot, meetingState, resolveRuling, secondMotion } from './meetings';
import { isMember, motionMeta, topMotion } from './rules';

/**
 * 原型演示用的模拟与会者：
 * 除当前操作身份外，其余成员会自动附议、投票，主持身份空闲时自动裁决。
 */

let timer: ReturnType<typeof setInterval> | null = null;

function botMembers(): string[] {
  const m = meetingState.meeting;
  return m.members.filter(id => id !== meetingState.currentUserId);
}

/** 固定演示策略：相同用户和投票编号始终产生相同选择。 */
function demoBallot(userId: string, voteId: number): (typeof BallotMap)[keyof typeof BallotMap] {
  const score = [...userId].reduce((total, char) => total + char.charCodeAt(0), voteId) % 10;
  if (score < 6)
    return BallotMap.YEA;
  if (score < 8)
    return BallotMap.NAY;
  return BallotMap.ABSTAIN;
}

function tick(): void {
  const m = meetingState.meeting;

  // 主持身份未被占用时，模拟主持裁决程序问题等事项
  if (meetingState.pendingRulingMotionId != null && m.profile.chair !== meetingState.currentUserId) {
    resolveRuling(true, m.profile.chair);
    return;
  }

  // 自动投票：每个 tick 只推进一个席位，避免结票后继续访问已关闭投票。
  if (m.activeVote) {
    const voteId = m.activeVote.id;
    const bot = botMembers().find(id => m.activeVote?.ballots[id] === undefined);
    if (bot)
      castBallot(demoBallot(bot, voteId), bot);
    return;
  }

  // 自动附议（提出人不能附议自己的动议）
  const motion = topMotion(m);
  if (motion && motion.status === MotionStatusMap.DRAFT && motionMeta(motion.type).needsSecond) {
    const bot = botMembers().find(id => id !== motion.proposer && !motion.seconders.includes(id));
    if (bot)
      secondMotion(motion.id, bot);
  }
}

export function startBots(): void {
  if (timer)
    return;
  timer = setInterval(tick, 1500);
}

export function stopBots(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** 供调试：判断某用户是否由模拟器驱动。 */
export function isBot(userId: string): boolean {
  return isMember(meetingState.meeting, userId) && userId !== meetingState.currentUserId;
}
