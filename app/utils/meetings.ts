import type { MeetingCommand } from '#shared/domain/commands';
import type { MeetingEvent } from '#shared/domain/events';
import type {
  AgendaItem,
  AgendaItemStatus,
  Ballot,
  Meeting,
  Motion,
  MotionType,
} from '#shared/utils/mettings';
import { toRaw } from 'vue';
import { applyMeetingEvents, decideMeetingCommand } from '#shared/domain/meeting-machine';
import { ActorKindMap } from '#shared/domain/schemas';
import {
  AgendaItemStatusMap,
  MeetingStatusMap,
  MotionStatusMap,
  MotionTypeMap,
  VoteMethodMap,
} from '#shared/utils/mettings';
import {
  activeMotions,
  canAssignFloor,
  canEndFloor,
  canEndMeeting,
  canGrabFloor,
  canResumeMeeting,
  canStartMeeting,
  canSwitchAgenda,
  canToggleRecordMode,
  isChair,
  isMember,
  laidAsideMotions,
  motionMeta,
} from './rules';

export interface DemoUser {
  id: string
  name: string
}

/** 原型演示用的与会者名册。 */
export const DEMO_USERS: DemoUser[] = [
  { id: 'u1', name: '张三' },
  { id: 'u2', name: '李四' },
  { id: 'u3', name: '王五' },
  { id: 'u4', name: '赵六' },
  { id: 'u5', name: '孙七' },
  { id: 'u6', name: '周八' },
];

export type LogKind = 'system' | 'meeting' | 'floor' | 'motion' | 'second' | 'vote' | 'ballot' | 'agenda' | 'ruling';
export type LogTone = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: number
  kind: LogKind
  at: number
  actor: string | null
  icon: string
  text: string
  tone: LogTone
}

export function createMeeting(): Meeting {
  return {
    schema: 1,
    id: 1,
    profile: { title: '2026 年度会员大会 · 第一次会议', chair: 'u1' },
    status: MeetingStatusMap.NOT_STARTED,
    recordMode: false,
    floor: [],
    floorHolder: null,
    floorGrabAt: null,
    members: ['u1', 'u2', 'u3', 'u4', 'u5'],
    observers: ['u6'],
    agenda: [
      { id: 1, title: '审议 2025 年度财务报告', details: '由财务委员会汇报年度收支情况，审议后表决是否通过。', status: AgendaItemStatusMap.PENDING, scheduledAt: null, isSpecial: false },
      { id: 2, title: '新会员入会审批', details: '审议本季度三位新会员的入会申请。', status: AgendaItemStatusMap.PENDING, scheduledAt: null, isSpecial: false },
      { id: 3, title: '年度大会筹备方案', details: '讨论年度大会的举办时间、地点与预算安排。', status: AgendaItemStatusMap.PENDING, scheduledAt: null, isSpecial: true },
      { id: 4, title: '章程修订草案（第二条）', details: '就章程第二条关于会员表决权的修订草案进行审议。', status: AgendaItemStatusMap.PENDING, scheduledAt: null, isSpecial: false },
    ],
    currentAgendaId: 1,
    motions: [],
    votes: [],
    activeVote: null,
    voteDuration: 60,
    startedAt: null,
  };
}

export const meetingState = reactive({
  meeting: createMeeting(),
  /** 当前操作身份（原型可切换视角）。 */
  currentUserId: 'u1',
  logs: [] as LogEntry[],
  /** 等待主持裁决的动议 id。 */
  pendingRulingMotionId: null as number | null,
});

/** 投票截止定时器（不放入响应式状态）。 */
let voteTimer: ReturnType<typeof setTimeout> | null = null;
let logSeq = 0;
let domainCommandSeq = 0;

export function userName(id: string | null | undefined): string {
  if (!id)
    return '系统';
  return DEMO_USERS.find(u => u.id === id)?.name ?? id;
}

export function currentUser(): DemoUser {
  return DEMO_USERS.find(u => u.id === meetingState.currentUserId) ?? DEMO_USERS[0]!;
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', { hour12: false });
}

export function log(text: string, opts: { kind?: LogKind, actor?: string | null, icon?: string, tone?: LogTone } = {}): void {
  meetingState.logs.push({
    id: ++logSeq,
    kind: opts.kind ?? 'system',
    at: Date.now(),
    actor: opts.actor ?? null,
    icon: opts.icon ?? 'i-lucide-info',
    text,
    tone: opts.tone ?? 'info',
  });
  if (meetingState.logs.length > 200)
    meetingState.logs.splice(0, meetingState.logs.length - 200);
}

function motionById(id: number): Motion | undefined {
  return meetingState.meeting.motions.find(m => m.id === id);
}

function nextMotionId(): number {
  return meetingState.meeting.motions.reduce((max, m) => Math.max(max, m.id), 0) + 1;
}

function nextVoteId(): number {
  const active = meetingState.meeting.activeVote?.id ?? 0;
  return Math.max(meetingState.meeting.votes.reduce((max, v) => Math.max(max, v.id), 0), active) + 1;
}

function nextAgendaId(): number {
  return meetingState.meeting.agenda.reduce((max, a) => Math.max(max, a.id), 0) + 1;
}

function clearVoteTimer(): void {
  if (voteTimer) {
    clearTimeout(voteTimer);
    voteTimer = null;
  }
}

function commandId(type: MeetingCommand['type'], issuedAt: number): string {
  return `demo:${meetingState.meeting.id}:${type}:${issuedAt}:${++domainCommandSeq}`;
}

function humanActor(userId: string) {
  return {
    id: userId,
    seatId: userId,
    kind: ActorKindMap.HUMAN,
    mandateId: null,
  };
}

function systemActor() {
  return {
    id: 'system',
    seatId: 'system',
    kind: ActorKindMap.SYSTEM,
    mandateId: null,
  };
}

function executeDomainCommand(command: MeetingCommand): { events: MeetingEvent[] } | { error: string } {
  const meeting = structuredClone(toRaw(meetingState.meeting)) as Meeting;
  const decision = decideMeetingCommand(meeting, command);
  if (decision.status === 'rejected')
    return { error: decision.reason };
  if (decision.status === 'requires-approval')
    return { error: `需要真人确认：${decision.reason}` };
  meetingState.meeting = applyMeetingEvents(meeting, decision.events);
  return { events: decision.events };
}

// ===== 会议控制 =====

export function startMeeting(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canStartMeeting(m, userId);
  if (!check.ok)
    return check.reason!;
  m.status = MeetingStatusMap.IN_PROGRESS;
  m.startedAt = Date.now();
  log(`@${userName(userId)} 宣布会议开始`, { kind: 'meeting', actor: userId, icon: 'i-lucide-play', tone: 'success' });
  return null;
}

export function endMeeting(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canEndMeeting(m, userId);
  if (!check.ok)
    return check.reason!;
  doEndMeeting(userId);
  return null;
}

function doEndMeeting(userId: string | null): void {
  const m = meetingState.meeting;
  clearVoteTimer();
  m.status = MeetingStatusMap.ENDED;
  m.activeVote = null;
  m.floor = [];
  m.floorHolder = null;
  meetingState.pendingRulingMotionId = null;
  for (const motion of m.motions) {
    if (motion.status !== MotionStatusMap.DISPOSED && motion.status !== MotionStatusMap.LAID_ASIDE) {
      motion.status = MotionStatusMap.DISPOSED;
    }
  }
  log(userId ? `@${userName(userId)} 宣布会议结束` : '休会动议通过，会议结束', {
    kind: 'meeting',
    actor: userId,
    icon: 'i-lucide-square',
    tone: 'warning',
  });
}

export function resumeMeeting(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canResumeMeeting(m, userId);
  if (!check.ok)
    return check.reason!;
  m.status = MeetingStatusMap.IN_PROGRESS;
  log(`@${userName(userId)} 宣布恢复会议`, { kind: 'meeting', actor: userId, icon: 'i-lucide-play', tone: 'success' });
  return null;
}

export function toggleRecordMode(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canToggleRecordMode(m, userId);
  if (!check.ok)
    return check.reason!;
  m.recordMode = !m.recordMode;
  log(m.recordMode ? '记录模式已开启，操作限制解除' : '记录模式已关闭', {
    kind: 'meeting',
    actor: userId,
    icon: 'i-lucide-pencil-line',
    tone: m.recordMode ? 'warning' : 'info',
  });
  return null;
}

// ===== 发言权 =====

export function grabFloor(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canGrabFloor(m, userId);
  if (!check.ok)
    return check.reason!;
  m.floorHolder = userId;
  m.floorGrabAt = null;
  m.floor = [];
  log(`@${userName(userId)} 抢到发言权`, { kind: 'floor', actor: userId, icon: 'i-lucide-mic', tone: 'success' });
  return null;
}

export function endFloor(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canEndFloor(m, userId);
  if (!check.ok)
    return check.reason!;
  releaseFloor();
  return null;
}

/** 释放发言权，开启 3 秒倒计时后允许抢夺。 */
function releaseFloor(): void {
  const m = meetingState.meeting;
  const holder = m.floorHolder;
  if (holder)
    log(`@${userName(holder)} 结束发言`, { kind: 'floor', actor: holder, icon: 'i-lucide-mic-off' });
  m.floorHolder = null;
  m.floor = [];
  m.floorGrabAt = Date.now() + 3000;
  log('发言权将在 3 秒后开放抢夺', { kind: 'floor', icon: 'i-lucide-timer' });
}

export function assignFloor(targetId: string, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canAssignFloor(m, userId);
  if (!check.ok)
    return check.reason!;
  if (!isMember(m, targetId))
    return '只能分配给会议成员';
  m.floor = [];
  m.floorGrabAt = null;
  m.floorHolder = targetId;
  log(`主持将发言权分配给 @${userName(targetId)}`, { kind: 'floor', actor: targetId, icon: 'i-lucide-mic', tone: 'success' });
  return null;
}

export function revokeFloor(userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canAssignFloor(m, userId);
  if (!check.ok)
    return check.reason!;
  releaseFloor();
  return null;
}

// ===== 动议 =====

export interface MotionInput {
  type: MotionType
  content: string
  details: string
}

export function proposeMotion(input: MotionInput, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const issuedAt = Date.now();
  const motionId = nextMotionId();
  const meta = motionMeta(input.type);
  const viaNoFloor = !meta.needsFloor && m.floorHolder !== userId;
  const execution = executeDomainCommand({
    version: 1,
    commandId: commandId('PROPOSE_MOTION', issuedAt),
    type: 'PROPOSE_MOTION',
    meetingId: m.id,
    actor: humanActor(userId),
    issuedAt,
    payload: {
      motionId,
      motionType: input.type,
      content: input.content,
      details: input.details,
    },
  });
  if ('error' in execution)
    return execution.error;
  const motion = motionById(motionId)!;
  log(
    `@${userName(userId)} 提出动议 #M${motion.id}【${meta.label}】${motion.content}${viaNoFloor ? '（无需发言权，临时夺下发言权）' : ''}`,
    { kind: 'motion', actor: userId, icon: 'i-lucide-file-plus-2' },
  );
  if (meta.chairRules) {
    meetingState.pendingRulingMotionId = motion.id;
  }
  return null;
}

export function resolveRuling(uphold: boolean, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const motionId = meetingState.pendingRulingMotionId;
  if (motionId == null)
    return '当前没有待裁决的事项';
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可裁决';
  const motion = motionById(motionId);
  meetingState.pendingRulingMotionId = null;
  if (!motion)
    return '动议不存在';
  motion.status = MotionStatusMap.DISPOSED;
  log(
    `主持裁决：#M${motion.id}【${motionMeta(motion.type).label}】${uphold ? '成立' : '不成立'}`,
    { kind: 'ruling', actor: userId, icon: 'i-lucide-gavel', tone: uphold ? 'warning' : 'info' },
  );
  return null;
}

export function secondMotion(motionId: number, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const issuedAt = Date.now();
  const execution = executeDomainCommand({
    version: 1,
    commandId: commandId('SECOND_MOTION', issuedAt),
    type: 'SECOND_MOTION',
    meetingId: m.id,
    actor: humanActor(userId),
    issuedAt,
    payload: { motionId },
  });
  if ('error' in execution)
    return execution.error;
  log(`@${userName(userId)} 附议了动议 #M${motionId}`, { kind: 'second', actor: userId, icon: 'i-lucide-thumbs-up' });
  log(`动议 #M${motionId} 已获附议，进入辩论阶段`, { kind: 'motion', icon: 'i-lucide-message-square', tone: 'success' });
  return null;
}

// ===== 投票 =====

export function openVote(motionId: number, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const issuedAt = Date.now();
  const durationSeconds = m.voteDuration;
  const execution = executeDomainCommand({
    version: 1,
    commandId: commandId('OPEN_VOTE', issuedAt),
    type: 'OPEN_VOTE',
    meetingId: m.id,
    actor: humanActor(userId),
    issuedAt,
    payload: {
      motionId,
      voteId: nextVoteId(),
      durationSeconds,
    },
  });
  if ('error' in execution)
    return execution.error;
  log(`主持开启对动议 #M${motionId} 的投票（${m.voteDuration} 秒）`, { kind: 'vote', actor: userId, icon: 'i-lucide-vote', tone: 'warning' });
  clearVoteTimer();
  voteTimer = setTimeout(closeVote, durationSeconds * 1000);
  return null;
}

export function castBallot(ballot: Ballot, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const issuedAt = Date.now();
  const execution = executeDomainCommand({
    version: 1,
    commandId: commandId('CAST_BALLOT', issuedAt),
    type: 'CAST_BALLOT',
    meetingId: m.id,
    actor: humanActor(userId),
    issuedAt,
    payload: { ballot },
  });
  if ('error' in execution)
    return execution.error;
  const updated = meetingState.meeting;
  if (updated.activeVote && Object.keys(updated.activeVote.ballots).length >= updated.members.length) {
    closeVote();
  }
  return null;
}

export function closeVote(userId?: string): string | null {
  const m = meetingState.meeting;
  const vote = m.activeVote;
  if (!vote)
    return '当前没有进行中的投票';
  const underlyingMotion = activeMotions(m).findLast(motion => motion.id !== vote.motionId) ?? null;
  const restorableMotion = laidAsideMotions(m).at(-1) ?? null;
  const issuedAt = Date.now();
  const execution = executeDomainCommand({
    version: 1,
    commandId: commandId('CLOSE_VOTE', issuedAt),
    type: 'CLOSE_VOTE',
    meetingId: m.id,
    actor: userId ? humanActor(userId) : systemActor(),
    issuedAt,
    payload: {},
  });
  if ('error' in execution)
    return execution.error;
  const decided = execution.events[0];
  if (!decided || (decided.type !== 'MOTION_PASSED' && decided.type !== 'MOTION_REJECTED'))
    return '领域状态机未产生投票结果';
  clearVoteTimer();
  const result = decided.payload.result;
  const motion = motionById(vote.motionId);
  if (motion)
    logMotionEffects(motion, result.passed, underlyingMotion, restorableMotion);
  log(
    `#V${result.id} 投票结果：${result.passed ? '通过' : '否决'}（赞成 ${result.yea.length} / 反对 ${result.nay.length} / 弃权 ${result.abstain.length}）`,
    { kind: 'vote', icon: result.passed ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle', tone: result.passed ? 'success' : 'error' },
  );
  return null;
}

/** 为领域状态机已经完成的后续效果生成演示日志。 */
function logMotionEffects(
  motion: Motion,
  passed: boolean,
  target: Motion | null,
  restored: Motion | null,
): void {
  const label = motionMeta(motion.type).label;
  if (!passed) {
    if (motion.type === MotionTypeMap.MAIN)
      log(`主动议被否决，议题继续讨论`, { kind: 'motion', icon: 'i-lucide-x' });
    return;
  }
  switch (motion.type) {
    case MotionTypeMap.LAY_ON_TABLE:
      if (target) {
        log(`动议 #M${target.id} 被搁置`, { kind: 'motion', icon: 'i-lucide-pause', tone: 'warning' });
      }
      break;
    case MotionTypeMap.POSTPONE_TO_TIME:
    case MotionTypeMap.REFER_TO_COMMITTEE:
      if (target) {
        log(`动议 #M${target.id} ${motion.type === MotionTypeMap.REFER_TO_COMMITTEE ? '已委托给委员会' : '已推迟'}，暂时移出审议`, { kind: 'motion', icon: 'i-lucide-pause', tone: 'warning' });
      }
      break;
    case MotionTypeMap.POSTPONE_INDEFINITELY:
      if (target) {
        log(`动议 #M${target.id} 被无限期推迟（视同否决）`, { kind: 'motion', icon: 'i-lucide-x', tone: 'error' });
      }
      break;
    case MotionTypeMap.AMEND:
      if (target) {
        log(`修正案通过，动议 #M${target.id} 内容已更新`, { kind: 'motion', icon: 'i-lucide-pencil', tone: 'success' });
      }
      break;
    case MotionTypeMap.PREVIOUS_QUESTION:
      log('辩论已截止，请主持对下一项动议开启投票', { kind: 'motion', icon: 'i-lucide-mic-off', tone: 'warning' });
      break;
    case MotionTypeMap.TAKE_FROM_TABLE:
      if (restored) {
        log(`动议 #M${restored.id} 恢复审议`, { kind: 'motion', icon: 'i-lucide-undo-2', tone: 'success' });
      }
      break;
    case MotionTypeMap.ADJOURN:
      meetingState.pendingRulingMotionId = null;
      log('休会动议通过，会议结束', {
        kind: 'meeting',
        icon: 'i-lucide-square',
        tone: 'warning',
      });
      break;
    case MotionTypeMap.RECESS:
      log('休息动议通过，会议进入休会状态', { kind: 'meeting', icon: 'i-lucide-coffee', tone: 'warning' });
      break;
    default:
      log(`【${label}】动议通过`, { kind: 'motion', icon: 'i-lucide-check', tone: 'success' });
  }
}

// ===== 议程 =====

export function switchAgenda(itemId: number, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  const check = canSwitchAgenda(m, userId);
  if (!check.ok)
    return check.reason!;
  const item = m.agenda.find(a => a.id === itemId);
  if (!item)
    return '议题不存在';
  m.currentAgendaId = itemId;
  log(`会议切换到议题「${item.title}」`, { kind: 'agenda', actor: userId, icon: 'i-lucide-list-video' });
  return null;
}

export function addAgendaItem(title: string, details: string, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可管理议程';
  const item: AgendaItem = {
    id: nextAgendaId(),
    title: title.trim(),
    details: details.trim(),
    status: AgendaItemStatusMap.PENDING,
    scheduledAt: null,
    isSpecial: false,
  };
  m.agenda.push(item);
  log(`主持新增议题「${item.title}」`, { kind: 'agenda', actor: userId, icon: 'i-lucide-list-plus' });
  return null;
}

export function updateAgendaItem(itemId: number, patch: { title?: string, details?: string, scheduledAt?: number | null, isSpecial?: boolean, status?: AgendaItemStatus }, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可管理议程';
  const item = m.agenda.find(a => a.id === itemId);
  if (!item)
    return '议题不存在';
  if (patch.title?.trim())
    item.title = patch.title.trim();
  if (patch.details !== undefined)
    item.details = patch.details.trim();
  if (patch.scheduledAt !== undefined)
    item.scheduledAt = patch.scheduledAt;
  if (patch.isSpecial !== undefined)
    item.isSpecial = patch.isSpecial;
  if (patch.status !== undefined)
    item.status = patch.status;
  log(`主持编辑议题「${item.title}」`, { kind: 'agenda', actor: userId, icon: 'i-lucide-pencil' });
  return null;
}

export function moveAgendaItem(itemId: number, direction: 'up' | 'down', userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可管理议程';
  const index = m.agenda.findIndex(a => a.id === itemId);
  if (index < 0)
    return '议题不存在';
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= m.agenda.length)
    return direction === 'up' ? '已在顶部' : '已在底部';
  const temp = m.agenda[index]!;
  m.agenda[index] = m.agenda[target]!;
  m.agenda[target] = temp;
  log(`主持调整议题「${temp.title}」顺序`, { kind: 'agenda', actor: userId, icon: 'i-lucide-arrow-up-down' });
  return null;
}

export function removeAgendaItem(itemId: number, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可管理议程';
  const index = m.agenda.findIndex(a => a.id === itemId);
  if (index < 0)
    return '议题不存在';
  const [item] = m.agenda.splice(index, 1);
  if (m.currentAgendaId === itemId) {
    m.currentAgendaId = m.agenda[0]?.id ?? null;
  }
  log(`主持移除议题「${item!.title}」`, { kind: 'agenda', actor: userId, icon: 'i-lucide-list-x', tone: 'warning' });
  return null;
}

// ===== 与会者 =====

export function transferChair(targetId: string, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可移交主持身份';
  if (!isMember(m, targetId))
    return '只能移交给会议成员';
  m.profile.chair = targetId;
  log(`主持身份移交给 @${userName(targetId)}`, { kind: 'meeting', actor: userId, icon: 'i-lucide-crown', tone: 'warning' });
  return null;
}

export function updateSettings(patch: { title?: string, voteDuration?: number }, userId = meetingState.currentUserId): string | null {
  const m = meetingState.meeting;
  if (!m.recordMode && !isChair(m, userId))
    return '仅主持可修改会议设置';
  if (patch.title?.trim())
    m.profile.title = patch.title.trim();
  if (patch.voteDuration)
    m.voteDuration = patch.voteDuration;
  log('会议设置已更新', { kind: 'meeting', actor: userId, icon: 'i-lucide-settings' });
  return null;
}

// ===== 统计（与会者详情弹窗） =====

export interface MemberStats {
  floorCount: number
  motionCount: number
  secondCount: number
  voteCount: number
}

export function memberStats(userId: string): MemberStats {
  const m = meetingState.meeting;
  return {
    floorCount: meetingState.logs.filter(l => l.kind === 'floor' && l.actor === userId && l.icon === 'i-lucide-mic').length,
    motionCount: m.motions.filter(motion => motion.proposer === userId).length,
    secondCount: meetingState.logs.filter(l => l.kind === 'second' && l.actor === userId).length,
    voteCount: m.votes.filter(v => v.method === VoteMethodMap.SIGNED_BALLOT && [...v.yea, ...v.nay, ...v.abstain].includes(userId)).length,
  };
}

// ===== 重置 =====

export function resetMeeting(): void {
  clearVoteTimer();
  meetingState.meeting = createMeeting();
  meetingState.currentUserId = 'u1';
  meetingState.logs = [];
  meetingState.pendingRulingMotionId = null;
  domainCommandSeq = 0;
}
