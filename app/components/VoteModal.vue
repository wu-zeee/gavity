<script setup lang="ts">
import type { Ballot } from '#shared/utils/mettings';
import { BallotMap, VoteTresholdMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const vote = computed(() => meeting.value.activeVote);
const motion = computed(() => (vote.value ? meeting.value.motions.find(m => m.id === vote.value!.motionId) : null));

const open = computed({
  get: () => uiState.voteModalOpen,
  set: (v: boolean) => {
    uiState.voteModalOpen = v;
  },
});

const selected = ref<Ballot | null>(null);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

const myBallot = computed(() => vote.value?.ballots[meetingState.currentUserId]);
const votedCount = computed(() => Object.keys(vote.value?.ballots ?? {}).length);
const totalCount = computed(() => meeting.value.members.length);
const remaining = computed(() => Math.max(0, Math.ceil(((vote.value?.deadlineAt ?? 0) - now.value) / 1000)));

const thresholdLabel = computed(() => {
  if (!vote.value)
    return '';
  if (vote.value.threshold === VoteTresholdMap.TWO_THIRDS)
    return '需三分之二多数通过';
  if (vote.value.threshold === VoteTresholdMap.UNANIMOUS)
    return '需全体一致通过';
  return '需简单多数通过';
});

const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);

const options = [
  { value: BallotMap.YEA, label: '赞成' },
  { value: BallotMap.NAY, label: '反对' },
  { value: BallotMap.ABSTAIN, label: '弃权' },
];

watch(vote, (v) => {
  selected.value = null;
  if (v && !clock) {
    clock = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  } else if (!v && clock) {
    clearInterval(clock);
    clock = null;
  }
}, { immediate: true });

onUnmounted(() => {
  if (clock)
    clearInterval(clock);
});

function confirm(): void {
  if (selected.value == null)
    return;
  const err = castBallot(selected.value);
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  toast.add({ title: '您的投票已提交', color: 'success', icon: 'i-lucide-check-circle-2' });
  selected.value = null;
  open.value = false;
}

function closeEarly(): void {
  const err = closeVote(meetingState.currentUserId);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <div class="modal-header">
          投票表决
        </div>

        <template v-if="vote && motion">
          <div class="modal-body !mb-0">
            <div class="person-card !mb-4">
              <div class="person-name">
                {{ motion.content }}
              </div>
              <div class="person-role">
                动议 #M{{ motion.id }} · {{ motionMeta(motion.type).label }}
              </div>
            </div>

            <div class="mb-4 flex items-center justify-between text-[13px] text-[#525252]">
              <span>{{ thresholdLabel }}</span>
              <span class="timer !mt-0 !text-[14px]">剩余 {{ remaining }} 秒</span>
            </div>

            <template v-if="myBallot === undefined">
              <div class="mb-4 grid grid-cols-3 gap-3">
                <button
                  v-for="opt in options"
                  :key="opt.value"
                  type="button"
                  class="btn"
                  :class="selected === opt.value ? 'btn-primary' : 'btn-secondary'"
                  @click="selected = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </template>
            <div v-else class="vote-display">
              <div>我的投票</div>
              <div class="text-[16px]">
                {{ myBallot === BallotMap.YEA ? '赞成 ✓' : myBallot === BallotMap.NAY ? '反对 ✓' : '弃权 ✓' }}
              </div>
            </div>

            <div class="mb-6 text-right text-[13px] text-[#525252]">
              已投票 {{ votedCount }}/{{ totalCount }} 人
            </div>
          </div>

          <div class="modal-footer justify-between">
            <div>
              <button
                v-if="isHost || meeting.recordMode"
                type="button"
                class="btn btn-secondary"
                @click="closeEarly"
              >
                提前结束投票
              </button>
            </div>
            <div class="flex gap-3">
              <button type="button" class="btn btn-secondary" @click="open = false">
                关闭
              </button>
              <button
                v-if="myBallot === undefined"
                type="button"
                class="btn btn-primary"
                :disabled="selected == null"
                @click="confirm"
              >
                确认投票
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="modal-body">
            当前没有进行中的投票。主持开启投票后，这里将显示表决内容。
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="open = false">
              关闭
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
