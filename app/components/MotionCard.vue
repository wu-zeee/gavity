<script setup lang="ts">
import type { Motion } from '#shared/utils/mettings';
import { MotionCategoryMap, MotionStatusMap } from '#shared/utils/mettings';

const props = defineProps<{
  motion: Motion
  /** 动议栈中位于其下的动议数量 */
  stackBelow: number
}>();

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const meta = computed(() => motionMeta(props.motion.type));

const categoryColor: Record<number, 'primary' | 'info' | 'warning' | 'secondary' | 'neutral'> = {
  [MotionCategoryMap.MAIN]: 'primary',
  [MotionCategoryMap.SUBSIDIARY]: 'info',
  [MotionCategoryMap.PRIVILEGED]: 'warning',
  [MotionCategoryMap.INCIDENTAL]: 'secondary',
  [MotionCategoryMap.RESTORATIVE]: 'neutral',
};

const statusColor: Record<number, 'warning' | 'info' | 'error' | 'neutral'> = {
  [MotionStatusMap.DRAFT]: 'warning',
  [MotionStatusMap.PENDING]: 'info',
  [MotionStatusMap.VOTING]: 'error',
};

const thresholdLabel = computed(() => meta.value.threshold === 2 ? '三分之二多数' : meta.value.threshold === 3 ? '全体一致' : '简单多数');

const secondCheck = computed(() => canSecondMotion(meeting.value, meetingState.currentUserId, props.motion));
const openVoteCheck = computed(() => canOpenVote(meeting.value, meetingState.currentUserId, props.motion));

const voteProgress = computed(() => {
  const vote = meeting.value.activeVote;
  if (!vote || vote.motionId !== props.motion.id)
    return null;
  return { voted: Object.keys(vote.ballots).length, total: meeting.value.members.length };
});

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}
</script>

<template>
  <div class="rounded-xl border-2 border-primary/60 bg-elevated p-4 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UBadge :color="categoryColor[meta.category]" variant="subtle">
        {{ MOTION_CATEGORY_LABELS[meta.category] }}
      </UBadge>
      <span class="font-semibold text-highlighted">{{ meta.label }}</span>
      <UBadge :color="statusColor[motion.status] ?? 'neutral'" variant="soft" size="sm">
        {{ MOTION_STATUS_LABELS[motion.status] }}
      </UBadge>
      <span class="text-xs text-dimmed">#M{{ motion.id }}</span>
      <div class="flex-1" />
      <span class="text-xs text-muted">{{ formatTime(motion.createdAt) }}</span>
    </div>

    <p class="mt-2.5 text-sm text-default">
      {{ motion.content }}
    </p>
    <p v-if="motion.details" class="mt-1 text-xs text-muted">
      {{ motion.details }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-user-round" class="size-3.5" />
        {{ userName(motion.proposer) }} 提出
      </span>
      <span v-if="meta.needsSecond" class="flex items-center gap-1">
        <UIcon name="i-lucide-thumbs-up" class="size-3.5" />
        {{ motion.seconders.length }}/{{ meeting.secondsRequired }} 人已附议
        <template v-if="motion.seconders.length">（{{ motion.seconders.map(userName).join('、') }}）</template>
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-lucide-vote" class="size-3.5" />
        {{ thresholdLabel }}
      </span>
      <span v-if="meta.debatable" class="flex items-center gap-1">
        <UIcon name="i-lucide-messages-square" class="size-3.5" />
        可辩论
      </span>
    </div>

    <div v-if="stackBelow" class="mt-2 text-xs text-muted">
      <UIcon name="i-lucide-layers" class="mr-1 inline size-3.5" />
      下方还有 {{ stackBelow }} 项待处理动议
    </div>

    <div class="mt-3 flex items-center gap-2 border-t border-muted pt-3">
      <UTooltip v-if="motion.status === MotionStatusMap.DRAFT" :text="secondCheck.ok ? '支持该动议进入讨论' : secondCheck.reason">
        <UButton
          label="附议"
          icon="i-lucide-thumbs-up"
          size="sm"
          :disabled="!secondCheck.ok"
          @click="run(secondMotion(motion.id))"
        />
      </UTooltip>
      <UTooltip v-if="motion.status === MotionStatusMap.PENDING" :text="openVoteCheck.ok ? '对该动议发起表决' : openVoteCheck.reason">
        <UButton
          label="开启投票"
          icon="i-lucide-vote"
          size="sm"
          color="warning"
          :disabled="!openVoteCheck.ok"
          @click="run(openVote(motion.id))"
        />
      </UTooltip>
      <div v-if="motion.status === MotionStatusMap.VOTING && voteProgress" class="flex items-center gap-2 text-xs text-warning">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
        投票进行中：{{ voteProgress.voted }}/{{ voteProgress.total }} 人已投票
      </div>
    </div>
  </div>
</template>
