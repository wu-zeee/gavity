import type { Ballot, Meeting, VoteResult } from '#shared/utils/mettings';
import { AgendaItemStatusMap, BallotMap, MeetingStatusMap, MotionStatusMap, VoteMethodMap } from '#shared/utils/mettings';
import { topMotion } from './rules';

/** 弹窗等全局 UI 状态（非会议数据）。 */
export const uiState = reactive({
  motionModalOpen: false,
  voteModalOpen: false,
  settingsModalOpen: false,
  helpModalOpen: false,
  memberDetailId: null as string | null,
  dataPanelOpen: false,
});

/** Robert UI 设计稿的阶段状态机（useMotionFlow）：idle → seconding → debate → voting → announcement。 */
export type MotionStage = 'idle' | 'seconding' | 'debate' | 'voting' | 'announcement';

/** 由会议数据推导设计稿阶段。 */
export function motionStage(meeting: Meeting): MotionStage {
  if (meeting.status !== MeetingStatusMap.IN_PROGRESS && meeting.status !== MeetingStatusMap.VOTING)
    return 'idle';
  if (meeting.activeVote)
    return 'voting';
  const motion = topMotion(meeting);
  if (motion)
    return motion.status === MotionStatusMap.DRAFT ? 'seconding' : 'debate';
  if (meeting.votes.length)
    return 'announcement';
  return 'idle';
}

/**
 * 设计稿参与者的立场（affiliation）。
 * 项目数据模型无立场概念，以记名投票的选择为立场：反对者归反对方，其余归支持方。
 */
export function affiliationOf(meeting: Meeting, userId: string): '支持方' | '反对方' {
  return meeting.activeVote?.ballots[userId] === BallotMap.NAY ? '反对方' : '支持方';
}

/** 设计稿 timer：m:ss 等宽显示（发言计时 / 投票倒计时）。 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** 设计稿徽章文本（单色大写徽章仅文字区分阶段）。 */
export const MOTION_STAGE_LABELS: Record<MotionStage, string> = {
  idle: '空闲',
  seconding: '等待附议',
  debate: '辩论中',
  voting: '投票中',
  announcement: '结果公布',
};

/** 议程议题状态展示（设计稿单色风格）。 */
export const AGENDA_STATUS_META: Record<number, { label: string, icon: string, class: string }> = {
  [AgendaItemStatusMap.PENDING]: { label: '待讨论', icon: 'i-lucide-circle', class: 'text-[#8a8a8a]' },
  [AgendaItemStatusMap.DISCUSSING]: { label: '讨论中', icon: 'i-lucide-message-circle', class: 'text-[#0a0a0a]' },
  [AgendaItemStatusMap.PASSED]: { label: '已通过', icon: 'i-lucide-check-circle-2', class: 'text-[#0a0a0a]' },
  [AgendaItemStatusMap.REJECTED]: { label: '已否决', icon: 'i-lucide-x-circle', class: 'text-[#525252]' },
};

/** 投票计票（兼容记名与不记名结果）。 */
export function voteTally(vote: VoteResult): { yea: number, nay: number, abstain: number } {
  if (vote.method === VoteMethodMap.SIGNED_BALLOT)
    return { yea: vote.yea.length, nay: vote.nay.length, abstain: vote.abstain.length };
  if (vote.method === VoteMethodMap.SECRET_BALLOT)
    return { yea: vote.yea, nay: vote.nay, abstain: vote.abstain };
  return { yea: 0, nay: 0, abstain: 0 };
}

export function voteCountDisplay(vote: VoteResult): string {
  const tally = voteTally(vote);
  return `赞成 ${tally.yea} / 反对 ${tally.nay} / 弃权 ${tally.abstain}`;
}

/** 记名投票中投某选项的成员 id 列表（设计稿支持方/反对方分栏数据）。 */
export function ballotVoters(ballots: Record<string, Ballot>, ballot: Ballot): string[] {
  return Object.entries(ballots).filter(([, b]) => b === ballot).map(([id]) => id);
}

/** 赞成/反对占比（设计稿投票统计进度条，不含弃权）。 */
export function voteShare(yea: number, nay: number, count: number): number {
  const total = yea + nay;
  return total ? (count / total) * 100 : 0;
}
