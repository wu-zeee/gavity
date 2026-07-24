<script setup lang="ts">
import { BallotMap, MeetingStatusMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const selfId = computed(() => meetingState.currentUserId);

// ===== 设计稿状态（接入会议数据） =====

const currentMotion = computed(() => topMotion(meeting.value));
const floor = computed(() => meeting.value.floor);
const floorHolder = computed(() => meeting.value.floorHolder);
const activeVote = computed(() => meeting.value.activeVote);

const yeaCount = computed(() => (activeVote.value ? ballotVoters(activeVote.value.ballots, BallotMap.YEA).length : 0));
const nayCount = computed(() => (activeVote.value ? ballotVoters(activeVote.value.ballots, BallotMap.NAY).length : 0));
const abstainCount = computed(() => (activeVote.value ? ballotVoters(activeVote.value.ballots, BallotMap.ABSTAIN).length : 0));

const secondCheck = computed(() => (currentMotion.value ? canSecondMotion(meeting.value, selfId.value, currentMotion.value) : { ok: false, reason: '' } as const));
const openVoteCheck = computed(() => (currentMotion.value ? canOpenVote(meeting.value, selfId.value, currentMotion.value) : { ok: false, reason: '' } as const));
const canAssign = computed(() => canAssignFloor(meeting.value, selfId.value).ok);
const holdingFloor = computed(() => floorHolder.value === selfId.value);

/** 设计稿「添加成员至队列」候选。 */
const queueCandidates = computed(() =>
  meeting.value.members.filter(id => id !== floorHolder.value && !floor.value.includes(id)),
);

/** 设计稿 2 分钟发言倒计时（支持暂停/重置/延时，纯界面状态）。 */
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

const speechLimit = ref(120);
const floorSince = ref<number | null>(null);
const pausedAt = ref<number | null>(null);
const pausedTotal = ref(0);
watch(floorHolder, (holder) => {
  floorSince.value = holder ? Date.now() : null;
  pausedAt.value = null;
  pausedTotal.value = 0;
  speechLimit.value = 120;
}, { immediate: true });

const speechRemaining = computed(() => {
  if (!floorSince.value)
    return speechLimit.value;
  const end = pausedAt.value ?? now.value;
  const elapsed = Math.floor((end - floorSince.value - pausedTotal.value) / 1000);
  return Math.max(0, speechLimit.value - elapsed);
});
const isTimerRunning = computed(() => floorSince.value != null && pausedAt.value == null);

function toggleTimer(): void {
  if (pausedAt.value != null) {
    pausedTotal.value += Date.now() - pausedAt.value;
    pausedAt.value = null;
  } else {
    pausedAt.value = Date.now();
  }
}

function resetTimer(): void {
  floorSince.value = Date.now();
  pausedAt.value = null;
  pausedTotal.value = 0;
  speechLimit.value = 120;
}

function extendTimer(): void {
  speechLimit.value += 60;
}

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function onRecognizeNext(): void {
  const next = floor.value[0];
  if (next)
    run(assignFloor(next));
}

function onRecordSecond(): void {
  if (currentMotion.value)
    run(secondMotion(currentMotion.value.id));
}

function onMoveToVote(): void {
  if (currentMotion.value)
    run(openVote(currentMotion.value.id));
}

function onEndSpeech(): void {
  if (holdingFloor.value)
    run(endFloor());
  else run(revokeFloor());
}
</script>

<template>
  <div>
    <MeetingMinutes v-if="meeting.status === MeetingStatusMap.ENDED" />

    <template v-else>
      <!-- Tab 导航 -->
      <nav class="container !pb-0">
        <div class="tabs">
          <button type="button" class="tab-btn" @click="showMemberView()">
            议员端
          </button>
          <button type="button" class="tab-btn active">
            主持端
          </button>
        </div>
      </nav>

      <div class="container !pt-12">
        <div class="grid-2">
          <!-- 左列 -->
          <div>
            <!-- 当前动议控制 -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  当前动议控制
                </div>
                <div class="section-subtitle">
                  管理进行中的辩论流程
                </div>
              </div>

              <div class="mb-6 border border-[#e4e4e4] bg-[#fafafa] p-6">
                <template v-if="currentMotion">
                  <div class="mb-2 text-[16px] font-medium">
                    {{ currentMotion.content }}
                  </div>
                  <div class="text-[13px] text-[#525252]">
                    提议人：{{ userName(currentMotion.proposer) }}
                    <template v-if="currentMotion.seconders.length">
                      | 附议人：{{ currentMotion.seconders.map(userName).join('、') }}
                    </template>
                    <template v-else>
                      | 等待附议（{{ currentMotion.seconders.length }}/{{ meeting.secondsRequired }}）
                    </template>
                  </div>
                </template>
                <div v-else class="text-[14px] text-[#525252]">
                  暂无进行中的动议
                </div>
              </div>

              <div class="flex flex-wrap gap-3">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canAssign || !floor.length"
                  title="承认队列首位成员发言"
                  @click="onRecognizeNext"
                >
                  承认发言
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="!secondCheck.ok"
                  :title="secondCheck.ok ? '' : secondCheck.reason"
                  @click="onRecordSecond"
                >
                  记录附议
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="!openVoteCheck.ok"
                  :title="openVoteCheck.ok ? '' : openVoteCheck.reason"
                  @click="onMoveToVote"
                >
                  移交表决
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="uiState.motionModalOpen = true"
                >
                  截止辩论
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="uiState.motionModalOpen = true"
                >
                  程序问题
                </button>
              </div>
            </div>

            <!-- 发言计时 -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  发言计时
                </div>
                <div class="section-subtitle">
                  当前发言者实时控制
                </div>
              </div>

              <template v-if="floorHolder">
                <div class="mb-6 flex items-baseline gap-8">
                  <div class="timer">
                    {{ formatTimer(speechRemaining) }}
                  </div>
                  <div>
                    <div class="person-name">
                      {{ userName(floorHolder) }}
                    </div>
                    <div class="person-role">
                      {{ affiliationOf(meeting, floorHolder) }}
                    </div>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button type="button" class="btn btn-secondary" @click="toggleTimer">
                    {{ isTimerRunning ? '暂停计时' : '继续计时' }}
                  </button>
                  <button type="button" class="btn btn-secondary" @click="resetTimer">
                    重置 (02:00)
                  </button>
                  <button type="button" class="btn btn-secondary" @click="extendTimer">
                    延时 (+1 分钟)
                  </button>
                  <button type="button" class="btn btn-primary" @click="onEndSpeech">
                    结束发言
                  </button>
                </div>
              </template>
              <div v-else class="text-[14px] text-[#525252]">
                发言权空闲
              </div>
            </div>
          </div>

          <!-- 右列 -->
          <div>
            <!-- 发言队列 -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  发言队列（{{ floor.length }} 人等待）
                </div>
                <div class="section-subtitle">
                  管理发言顺序
                </div>
              </div>

              <div v-for="(id, index) in floor" :key="id" class="queue-item">
                <div class="flex items-center">
                  <div class="queue-number">
                    {{ index + 1 }}
                  </div>
                  <div>
                    <div class="person-name">
                      {{ userName(id) }}
                    </div>
                    <div class="person-role">
                      {{ affiliationOf(meeting, id) }}
                    </div>
                  </div>
                </div>
                <div v-if="canAssign" class="queue-actions">
                  <button type="button" class="btn btn-primary btn-icon" title="承认发言" @click="run(assignFloor(id))">
                    ✓
                  </button>
                  <button type="button" class="btn btn-secondary btn-icon" title="调整顺序" @click="run(moveGrabUp(id))">
                    ↕
                  </button>
                  <button type="button" class="btn btn-secondary btn-icon" title="移除" @click="run(removeGrab(id))">
                    ×
                  </button>
                </div>
              </div>
              <div v-if="!floor.length" class="text-[14px] text-[#8a8a8a]">
                暂无排队人员
              </div>

              <div v-if="canAssign && queueCandidates.length" class="mt-6 border-t border-[#e4e4e4] pt-6">
                <div class="mb-3 text-[13px] text-[#525252]">
                  添加成员至队列
                </div>
                <button
                  v-for="id in queueCandidates"
                  :key="id"
                  type="button"
                  class="btn btn-secondary mr-3"
                  @click="run(addGrab(id))"
                >
                  + 添加 {{ userName(id) }}
                </button>
              </div>
            </div>

            <!-- 投票统计 -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">
                  投票统计
                </div>
                <div class="section-subtitle">
                  实时票数
                </div>
              </div>

              <div class="flex justify-around border border-[#e4e4e4] bg-[#fafafa] p-6">
                <div class="text-center">
                  <div class="mb-2 text-[48px] font-semibold">
                    {{ yeaCount }}
                  </div>
                  <div class="text-[13px] text-[#525252]">
                    赞成
                  </div>
                </div>
                <div class="text-center">
                  <div class="mb-2 text-[48px] font-semibold">
                    {{ nayCount }}
                  </div>
                  <div class="text-[13px] text-[#525252]">
                    反对
                  </div>
                </div>
                <div class="text-center">
                  <div class="mb-2 text-[48px] font-semibold">
                    {{ abstainCount }}
                  </div>
                  <div class="text-[13px] text-[#525252]">
                    弃权
                  </div>
                </div>
              </div>

              <div class="mt-6">
                <button
                  type="button"
                  class="btn btn-primary w-full"
                  :disabled="!activeVote"
                  @click="run(closeVote(selfId))"
                >
                  宣布结果
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="section">
          <div class="section-header">
            <div class="section-title">
              快捷操作
            </div>
            <div class="section-subtitle">
              常用主持功能
            </div>
          </div>

          <div class="flex flex-wrap gap-4">
            <button type="button" class="btn btn-secondary" @click="uiState.motionModalOpen = true">
              发起新动议
            </button>
            <button type="button" class="btn btn-secondary" @click="uiState.motionModalOpen = true">
              搁置动议
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!openVoteCheck.ok"
              :title="openVoteCheck.ok ? '' : openVoteCheck.reason"
              @click="onMoveToVote"
            >
              提请表决
            </button>
            <button type="button" class="btn btn-secondary" @click="uiState.motionModalOpen = true">
              重新审议
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!currentMotion"
              title="撤销当前动议"
              @click="run(withdrawMotion())"
            >
              撤销动议
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text">
          罗伯特议事规则 · AI 助手主持 v1.0
        </div>
      </div>
    </template>
  </div>
</template>
