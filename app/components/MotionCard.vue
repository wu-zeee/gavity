<script setup lang="ts">
import type { Motion } from '#shared/utils/mettings';
import { MotionStatusMap } from '#shared/utils/mettings';

const props = defineProps<{
  motion: Motion
}>();

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const meta = computed(() => motionMeta(props.motion.type));

const thresholdLabel = computed(() => meta.value.threshold === 2 ? '三分之二多数' : meta.value.threshold === 3 ? '全体一致' : '简单多数');

const isChairUser = computed(() => meeting.value.profile.chair === meetingState.currentUserId);
const secondCheck = computed(() => canSecondMotion(meeting.value, meetingState.currentUserId, props.motion));
const openVoteCheck = computed(() => canOpenVote(meeting.value, meetingState.currentUserId, props.motion));
const needsRuling = computed(() => meetingState.pendingRulingMotionId === props.motion.id);
const ballotCheck = computed(() => canCastBallot(meeting.value, meetingState.currentUserId));
const myBallot = computed(() => {
  const vote = meeting.value.activeVote;
  return vote && vote.motionId === props.motion.id ? vote.ballots[meetingState.currentUserId] : undefined;
});

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
      <UBadge color="neutral" variant="subtle">
        {{ MOTION_CATEGORY_LABELS[meta.category] }}
      </UBadge>
      <span class="font-semibold text-highlighted">{{ meta.label }}</span>
      <UBadge color="neutral" variant="soft" size="sm">
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
        {{ motion.seconders.length }}/1 人已附议
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

    <div class="mt-3 flex items-center gap-2 border-t border-muted pt-3">
      <!-- 附议 -->
      <UTooltip v-if="motion.status === MotionStatusMap.DRAFT" :text="secondCheck.ok ? '支持该动议进入讨论' : secondCheck.reason">
        <UButton
          label="附议"
          icon="i-lucide-thumbs-up"
          size="sm"
          :disabled="!secondCheck.ok"
          @click="run(secondMotion(motion.id))"
        />
      </UTooltip>

      <!-- 开启投票 -->
      <UTooltip v-if="motion.status === MotionStatusMap.PENDING && !needsRuling" :text="openVoteCheck.ok ? '对该动议发起表决' : openVoteCheck.reason">
        <UButton
          label="开启投票"
          icon="i-lucide-vote"
          size="sm"
          :disabled="!openVoteCheck.ok"
          @click="run(openVote(motion.id))"
        />
      </UTooltip>

      <!-- 主持裁决（与投票并列） -->
      <template v-if="needsRuling && isChairUser">
        <UButton
          label="裁决成立"
          icon="i-lucide-gavel"
          size="sm"
          color="primary"
          @click="run(resolveRuling(true))"
        />
        <UButton
          label="裁决不成立"
          icon="i-lucide-shield-x"
          size="sm"
          color="neutral"
          variant="outline"
          @click="run(resolveRuling(false))"
        />
      </template>

      <!-- 等待裁决提示 -->
      <div v-if="needsRuling && !isChairUser" class="flex items-center gap-2 text-xs">
        <UIcon name="i-lucide-gavel" class="size-4" />
        等待主持裁决…
      </div>

      <!-- 投票进行中 -->
      <template v-if="motion.status === MotionStatusMap.VOTING && voteProgress">
        <UButton
          v-if="ballotCheck.ok"
          label="投票"
          icon="i-lucide-vote"
          size="sm"
          @click="uiState.voteModalOpen = true"
        />
        <span v-else-if="myBallot !== undefined" class="flex items-center gap-1 text-xs text-success">
          <UIcon name="i-lucide-check-circle-2" class="size-4" />
          已投票
        </span>
        <span class="flex items-center gap-1 text-xs">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          {{ voteProgress.voted }}/{{ voteProgress.total }}
        </span>
      </template>
    </div>
  </div>
</template>
