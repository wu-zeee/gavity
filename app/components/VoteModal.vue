<script setup lang="ts">
import type { Ballot } from '#shared/utils/mettings';
import { BallotMap, VoteTresholdMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const vote = computed(() => meeting.value.activeVote);
const motion = computed(() => (vote.value ? meeting.value.motions.find(m => m.id === vote.value!.motionId) : null));

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
  { value: BallotMap.YEA, label: '赞成', icon: 'i-lucide-check', iconClass: 'text-success' },
  { value: BallotMap.NAY, label: '反对', icon: 'i-lucide-x', iconClass: 'text-error' },
  { value: BallotMap.ABSTAIN, label: '弃权', icon: 'i-lucide-minus', iconClass: 'text-muted' },
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
  uiState.voteModalOpen = false;
}

function closeEarly(): void {
  const err = closeVote(meetingState.currentUserId);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}
</script>

<template>
  <UModal v-model:open="uiState.voteModalOpen" title="投票表决" :description="motion ? `动议 #M${motion.id} · ${motionMeta(motion.type).label}` : ''" :ui="{ footer: 'justify-between' }">
    <template #body>
      <div v-if="vote && motion" class="space-y-4">
        <div class="rounded-md bg-muted px-3 py-2 text-sm text-default">
          {{ motion.content }}
        </div>

        <div class="flex items-center justify-between text-xs text-muted">
          <span>{{ thresholdLabel }}</span>
          <span class="flex items-center gap-1" :class="remaining <= 10 ? 'text-error' : ''">
            <UIcon name="i-lucide-timer" class="size-3.5" />
            剩余 {{ remaining }} 秒
          </span>
        </div>

        <template v-if="myBallot === undefined">
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="opt in options"
              :key="opt.value"
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-4 transition-colors"
              :class="selected === opt.value
                ? 'border-primary bg-accented'
                : 'border-default hover:border-accented hover:bg-elevated'"
              @click="selected = opt.value"
            >
              <UIcon :name="opt.icon" class="size-6" :class="opt.iconClass" />
              <span class="text-sm font-medium" :class="selected === opt.value ? 'text-highlighted' : 'text-default'">
                {{ opt.label }}
              </span>
            </button>
          </div>
        </template>
        <UAlert
          v-else
          icon="i-lucide-check-circle-2"
          color="success"
          variant="soft"
          title="您已投票"
          description="等待其他成员完成投票，或等待主持结束投票。"
        />

        <UProgress :model-value="votedCount" :max="totalCount" size="sm" />
        <div class="text-right text-xs text-muted">
          已投票 {{ votedCount }}/{{ totalCount }} 人
        </div>
      </div>
      <UEmpty v-else icon="i-lucide-vote" title="当前没有进行中的投票" description="主持开启投票后，这里将显示表决内容。" />
    </template>

    <template #footer="{ close }">
      <div>
        <UButton
          v-if="vote && (isHost || meeting.recordMode)"
          label="提前结束投票"
          color="neutral"
          variant="outline"
          size="sm"
          @click="closeEarly"
        />
      </div>
      <div class="flex gap-2">
        <UButton label="关闭" color="neutral" variant="outline" @click="close" />
        <UButton
          v-if="vote && myBallot === undefined"
          label="确认投票"
          :disabled="selected == null"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
