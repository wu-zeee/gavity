import { BallotMap, MotionStatusMap } from '#shared/utils/mettings';
import { castBallot, meetingState, resolveRuling, secondMotion } from './meetings';
import { isMember, motionMeta, topMotion } from './rules';

/**
 * 原型演示用的模拟与会者：
 * 除当前操作身份外，其余成员会自动附议、投票，主持身份空闲时自动裁决。
 */

let timer: ReturnType<typeof setInterval> | null = null;

/** 模拟器运行状态（对应设计稿主持端的「AI 辅助 / 人工」主持模式切换）。 */
export const botState = reactive({ running: false });

function botMembers(): string[] {
  const m = meetingState.meeting;
  return m.members.filter(id => id !== meetingState.currentUserId);
}

function randomBallot(): (typeof BallotMap)[keyof typeof BallotMap] {
  const roll = Math.random();
  if (roll < 0.55)
    return BallotMap.YEA;
  if (roll < 0.8)
    return BallotMap.NAY;
  return BallotMap.ABSTAIN;
}

function tick(): void {
  const m = meetingState.meeting;

  // 主持身份未被占用时，模拟主持裁决程序问题等事项
  if (meetingState.pendingRulingMotionId != null && m.profile.chair !== meetingState.currentUserId) {
    if (Math.random() < 0.6)
      resolveRuling(Math.random() < 0.6, m.profile.chair);
    return;
  }

  // 自动投票
  if (m.activeVote) {
    for (const bot of botMembers()) {
      if (m.activeVote.ballots[bot] === undefined && Math.random() < 0.5) {
        castBallot(randomBallot(), bot);
      }
    }
    return;
  }

  // 自动附议（提出人不能附议自己的动议）
  const motion = topMotion(m);
  if (motion && motion.status === MotionStatusMap.DRAFT && motionMeta(motion.type).needsSecond) {
    for (const bot of botMembers()) {
      if (bot !== motion.proposer && !motion.seconders.includes(bot) && Math.random() < 0.4) {
        secondMotion(motion.id, bot);
      }
    }
  }
}

export function startBots(): void {
  if (timer)
    return;
  timer = setInterval(tick, 1500);
  botState.running = true;
}

export function stopBots(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  botState.running = false;
}

/** 供调试：判断某用户是否由模拟器驱动。 */
export function isBot(userId: string): boolean {
  return isMember(meetingState.meeting, userId) && userId !== meetingState.currentUserId;
}
