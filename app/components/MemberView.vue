<script setup lang="ts">
import { BallotMap, MeetingStatusMap, VoteMethodMap, VoteTresholdMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const selfId = computed(() => meetingState.currentUserId);

// ===== 设计稿状态（接入会议数据） =====

const stage = computed(() => motionStage(meeting.value));
const currentMotion = computed(() => topMotion(meeting.value));
const floor = computed(() => meeting.value.floor);
const floorHolder = computed(() => meeting.value.floorHolder);
const activeVote = computed(() => meeting.value.activeVote);

const lastVote = computed(() => meeting.value.votes[meeting.value.votes.length - 1] ?? null);

/** 队列编号为全局顺序（设计稿：发言者为 1，等待者顺延）。 */
const queueItems = computed(() => floor.value.map((id, i) => ({ id, n: i + 1 })));
const proQueue = computed(() => queueItems.value.filter(q => affiliationOf(meeting.value, q.id) === '支持方'));
const conQueue = computed(() => queueItems.value.filter(q => affiliationOf(meeting.value, q.id) === '反对方'));
const speakerAffiliation = computed(() => (floorHolder.value ? affiliationOf(meeting.value, floorHolder.value) : null));

const isHandRaised = computed(() => floor.value.includes(selfId.value));
const holdingFloor = computed(() => floorHolder.value === selfId.value);
const grabCheck = computed(() => canGrabFloor(meeting.value, selfId.value));

const myBallot = computed(() => activeVote.value?.ballots[selfId.value]);
const yeaCount = computed(() => (activeVote.value ? ballotVoters(activeVote.value.ballots, BallotMap.YEA).length : 0));
const nayCount = computed(() => (activeVote.value ? ballotVoters(activeVote.value.ballots, BallotMap.NAY).length : 0));

const secondCheck = computed(() => (currentMotion.value ? canSecondMotion(meeting.value, selfId.value, currentMotion.value) : { ok: false, reason: '当前没有待附议的动议' } as const));

/** 设计稿 2 分钟发言倒计时（120 秒递减，纯界面状态）。 */
const SPEECH_LIMIT = 120;
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (clock)
    clearInterval(clock);
});

const floorSince = ref<number | null>(null);
watch(floorHolder, (holder) => {
  floorSince.value = holder ? Date.now() : null;
}, { immediate: true });
const speechRemaining = computed(() => {
  if (!floorSince.value)
    return SPEECH_LIMIT;
  const elapsed = Math.floor((now.value - floorSince.value) / 1000);
  return Math.max(0, SPEECH_LIMIT - elapsed);
});

/** 会议状态卡（设计稿 Current Session Status）。 */
const nextAction = computed(() => {
  switch (stage.value) {
    case 'seconding': return '等待成员附议';
    case 'debate': return '主持开启投票';
    case 'voting': return '全员投票';
    case 'announcement': return '宣布结果';
    default: break;
  }
  if (meeting.value.status === MeetingStatusMap.NOT_STARTED)
    return '开始会议';
  if (meeting.value.status === MeetingStatusMap.RECESSED)
    return '恢复会议';
  return '发起动议';
});

/** 结果公布时我的投票（记名结果）。 */
const myLastBallot = computed(() => {
  const vote = lastVote.value;
  if (!vote || vote.method !== VoteMethodMap.SIGNED_BALLOT)
    return null;
  if (vote.yea.includes(selfId.value))
    return BallotMap.YEA;
  if (vote.nay.includes(selfId.value))
    return BallotMap.NAY;
  if (vote.abstain.includes(selfId.value))
    return BallotMap.ABSTAIN;
  return null;
});

function ballotLabel(ballot: number | null | undefined): string {
  if (ballot === BallotMap.YEA)
    return '赞成 ✓';
  if (ballot === BallotMap.NAY)
    return '反对 ✓';
  if (ballot === BallotMap.ABSTAIN)
    return '弃权 ✓';
  return '未投票';
}

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function onGrabClick(): void {
  if (holdingFloor.value)
    run(endFloor());
  else if (isHandRaised.value)
    run(cancelGrab());
  else run(grabFloor());
}

const canPropose = computed(() => meeting.value.status === MeetingStatusMap.IN_PROGRESS || meeting.value.recordMode);

const thresholdLabel = computed(() => {
  if (!activeVote.value)
    return '';
  if (activeVote.value.threshold === VoteTresholdMap.TWO_THIRDS)
    return '需三分之二多数通过';
  if (activeVote.value.threshold === VoteTresholdMap.UNANIMOUS)
    return '需全体一致通过';
  return '需简单多数通过';
});
</script>

<template>
  <div>
    <MeetingMinutes v-if="meeting.status === MeetingStatusMap.ENDED" />

    <template v-else>
      <!-- Tab 导航（设计稿：每个视图各自渲染，激活态下划线） -->
      <nav class="container !pb-0">
        <div class="tabs">
          <button type="button" class="tab-btn active">
            议员端
          </button>
          <button type="button" class="tab-btn" @click="showModeratorView()">
            主持端
          </button>
        </div>
      </nav>

      <div class="container !pt-12">
        <header class="mb-12">
          <h1 class="mb-4 text-[28px] font-semibold">
            罗伯特议事规则会议
          </h1>
          <div class="text-[14px] text-[#525252]">
            当前动议：{{ currentMotion ? currentMotion.content : '暂无' }}
          </div>
        </header>

        <div class="grid-3">
          <!-- 支持方 -->
          <div>
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  支持方
                </div>
              </div>

              <div v-if="floorHolder && speakerAffiliation === '支持方'" class="person-card">
                <div class="person-name">
                  {{ userName(floorHolder) }}
                </div>
                <div class="person-role">
                  正在发言
                </div>
                <div class="timer">
                  {{ formatTimer(speechRemaining) }}
                </div>
              </div>

              <div class="queue-list">
                <div class="mb-3 text-[13px] text-[#525252]">
                  等待发言
                </div>
                <div v-for="q in proQueue" :key="q.id" class="queue-item">
                  <div class="flex items-center">
                    <div class="queue-number">
                      {{ q.n }}
                    </div>
                    <div>
                      <div class="person-name">
                        {{ userName(q.id) }}
                      </div>
                      <div class="person-role">
                        支持方
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="!proQueue.length && !(floorHolder && speakerAffiliation === '支持方')" class="text-[13px] text-[#8a8a8a]">
                  暂无
                </div>
              </div>

              <button
                type="button"
                class="btn mt-6 w-full"
                :class="holdingFloor || isHandRaised ? 'btn-primary' : 'btn-secondary'"
                :disabled="!holdingFloor && !isHandRaised && !grabCheck.ok"
                :title="grabCheck.ok || isHandRaised || holdingFloor ? '' : grabCheck.reason"
                @click="onGrabClick"
              >
                {{ holdingFloor ? '结束发言' : isHandRaised ? '已举手' : '举手发言' }}
              </button>
            </div>
          </div>

          <!-- 主持 -->
          <div>
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  主持
                </div>
              </div>
              <div class="person-card px-6 py-12 text-center">
                <div class="avatar mx-auto mb-4" />
                <div class="person-name">
                  {{ userName(meeting.profile.chair) }}
                </div>
                <div class="person-role">
                  中立主持
                </div>
                <div v-if="botState.running" class="mt-6 inline-block border border-[#e4e4e4] bg-white px-4 py-2 text-[13px]">
                  AI 辅助已启用
                </div>
              </div>

              <div class="section !mb-0 bg-[#fafafa]">
                <div class="section-title mb-4">
                  当前会议状态
                </div>
                <div class="mb-3 text-[14px]">
                  <span class="text-[#525252]">{{ MOTION_STAGE_LABELS[stage] }}</span>
                </div>
                <div class="text-[13px] text-[#525252]">
                  出席成员：{{ meeting.members.length }}<br>
                  法定人数：是<br>
                  下一步：{{ nextAction }}
                </div>
              </div>
            </div>
          </div>

          <!-- 反对方 -->
          <div>
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  反对方
                </div>
              </div>

              <div v-if="floorHolder && speakerAffiliation === '反对方'" class="person-card">
                <div class="person-name">
                  {{ userName(floorHolder) }}
                </div>
                <div class="person-role">
                  正在发言
                </div>
                <div class="timer">
                  {{ formatTimer(speechRemaining) }}
                </div>
              </div>

              <div class="queue-list">
                <div class="mb-3 text-[13px] text-[#525252]">
                  等待发言
                </div>
                <div v-for="q in conQueue" :key="q.id" class="queue-item">
                  <div class="flex items-center">
                    <div class="queue-number">
                      {{ q.n }}
                    </div>
                    <div>
                      <div class="person-name">
                        {{ userName(q.id) }}
                      </div>
                      <div class="person-role">
                        反对方
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="!conQueue.length && !(floorHolder && speakerAffiliation === '反对方')" class="text-[13px] text-[#8a8a8a]">
                  暂无
                </div>
              </div>

              <button
                type="button"
                class="btn mt-6 w-full"
                :class="holdingFloor || isHandRaised ? 'btn-primary' : 'btn-secondary'"
                :disabled="!holdingFloor && !isHandRaised && !grabCheck.ok"
                :title="grabCheck.ok || isHandRaised || holdingFloor ? '' : grabCheck.reason"
                @click="onGrabClick"
              >
                {{ holdingFloor ? '结束发言' : isHandRaised ? '已举手' : '举手发言' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 底部：动议与表决 -->
        <div class="section">
          <div class="section-header">
            <div class="badge">
              {{ MOTION_STAGE_LABELS[stage] }}
            </div>
            <div class="section-title">
              审议中的动议
            </div>
            <div class="section-subtitle">
              {{ currentMotion ? currentMotion.content : '暂无进行中的动议' }}
            </div>
          </div>

          <template v-if="activeVote">
            <div class="vote-display">
              <div>赞成票</div>
              <div class="vote-count">
                {{ yeaCount }}
              </div>
            </div>
            <div class="vote-display">
              <div>反对票</div>
              <div class="vote-count">
                {{ nayCount }}
              </div>
            </div>
            <div class="vote-display">
              <div>我的投票</div>
              <div class="text-[18px]">
                {{ ballotLabel(myBallot) }}
              </div>
            </div>
          </template>

          <template v-else-if="stage === 'announcement' && lastVote">
            <div class="vote-display">
              <div>表决结果</div>
              <div class="text-[18px] font-medium">
                {{ lastVote.passed ? '动议通过' : '动议未通过' }}
              </div>
            </div>
            <div class="vote-display">
              <div>票数统计</div>
              <div class="text-[14px] text-[#525252]">
                {{ voteCountDisplay(lastVote) }}
              </div>
            </div>
            <div class="vote-display">
              <div>我的投票</div>
              <div class="text-[18px]">
                {{ ballotLabel(myLastBallot) }}
              </div>
            </div>
          </template>

          <!-- 操作按钮（Gavity 需要的操作，按设计稿规格新增） -->
          <div class="mt-6 border border-[#e4e4e4] bg-[#fafafa] p-4">
            <div class="mb-2 text-[13px] text-[#525252]">
              操作按钮
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!canPropose"
              @click="uiState.motionModalOpen = true"
            >
              提出动议
            </button>
            <button
              v-if="stage === 'seconding' && currentMotion"
              type="button"
              class="btn btn-secondary ml-3"
              :disabled="!secondCheck.ok"
              :title="secondCheck.ok ? '' : secondCheck.reason"
              @click="run(secondMotion(currentMotion.id))"
            >
              附议动议
            </button>
            <button
              v-if="activeVote"
              type="button"
              class="btn btn-primary ml-3"
              @click="uiState.voteModalOpen = true"
            >
              投票表决
            </button>
            <span v-if="activeVote && thresholdLabel" class="ml-3 text-[13px] text-[#525252]">{{ thresholdLabel }}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text">
          罗伯特议事规则 · 会议 ID: MR-{{ meeting.id }} · Version 1.0
        </div>
      </div>
    </template>
  </div>
</template>
