<script setup lang="ts">
import { MeetingStatusMap, MotionStatusMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const selfId = computed(() => meetingState.currentUserId);

const grabCheck = computed(() => canGrabFloor(meeting.value, selfId.value));
const holdingFloor = computed(() => meeting.value.floorHolder === selfId.value);
const grabbing = computed(() => meeting.value.floor.includes(selfId.value));

const top = computed(() => topMotion(meeting.value));
const secondCheck = computed(() => (top.value ? canSecondMotion(meeting.value, selfId.value, top.value) : { ok: false, reason: '当前没有待附议的动议' }));
const ballotCheck = computed(() => canCastBallot(meeting.value, selfId.value));

const voteProgress = computed(() => {
  const vote = meeting.value.activeVote;
  if (!vote)
    return null;
  return { voted: Object.keys(vote.ballots).length, total: meeting.value.members.length };
});

/** 当前可执行操作的状态提示。 */
const hint = computed(() => {
  const m = meeting.value;
  if (m.recordMode)
    return '记录模式：所有操作限制已解除';
  switch (m.status) {
    case MeetingStatusMap.NOT_STARTED:
      return '会议尚未开始';
    case MeetingStatusMap.VOTING:
      return ballotCheck.value.ok ? '请对当前动议投票' : '投票进行中，请等待结果';
    case MeetingStatusMap.RECESSED:
      return '会议休会中';
    case MeetingStatusMap.ENDED:
      return '会议已结束';
    default:
      break;
  }
  if (holdingFloor.value)
    return '你持有发言权，可以提出动议或结束发言';
  if (grabbing.value)
    return '正在抢夺发言权，等待当前发言结束';
  if (top.value?.status === MotionStatusMap.DRAFT && secondCheck.value.ok)
    return '有动议待附议，可以附议';
  if (grabCheck.value.ok)
    return '可以抢夺发言权';
  return '请等待主持推进会议';
});

const logListRef = useTemplateRef('logList');

watch(
  () => meetingState.logs.length,
  async () => {
    await nextTick();
    const el = logListRef.value;
    if (el)
      el.scrollTop = el.scrollHeight;
  },
  { flush: 'post' },
);

const toneClass: Record<string, string> = {
  info: 'text-muted',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function onGrabClick(): void {
  if (holdingFloor.value)
    run(endFloor());
  else if (grabbing.value)
    run(cancelGrab());
  else run(grabFloor());
}

function onSecondClick(): void {
  if (!top.value)
    return;
  run(secondMotion(top.value.id));
}

function onVoteClick(): void {
  uiState.voteModalOpen = true;
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 操作按钮组 -->
    <div class="space-y-2 border-b border-default p-3">
      <UTooltip :text="holdingFloor ? '结束发言并移交发言权' : grabbing ? '退出本轮抢夺' : grabCheck.ok ? '先到先得，每轮重新开抢' : grabCheck.reason">
        <UButton
          block
          size="lg"
          :label="holdingFloor ? '结束发言' : grabbing ? '取消抢夺' : '抢发言权'"
          :icon="holdingFloor ? 'i-lucide-mic-off' : 'i-lucide-hand'"
          :color="holdingFloor ? 'warning' : 'primary'"
          :variant="grabbing ? 'outline' : 'solid'"
          :disabled="!holdingFloor && !grabbing && !grabCheck.ok"
          :class="meeting.recordMode ? 'border-dashed' : ''"
          @click="onGrabClick"
        />
      </UTooltip>

      <UTooltip text="从 20+ 种动议类型中选择并提交">
        <UButton
          block
          label="提出动议"
          icon="i-lucide-file-plus-2"
          variant="soft"
          :disabled="meeting.status !== MeetingStatusMap.IN_PROGRESS && !meeting.recordMode"
          :class="meeting.recordMode ? 'border-dashed' : ''"
          @click="uiState.motionModalOpen = true"
        />
      </UTooltip>

      <UTooltip :text="secondCheck.ok ? `附议当前动议（${top?.seconders.length ?? 0}/${meeting.secondsRequired}）` : secondCheck.reason">
        <UButton
          block
          label="附议"
          icon="i-lucide-thumbs-up"
          variant="soft"
          color="info"
          :disabled="!secondCheck.ok"
          :class="meeting.recordMode ? 'border-dashed' : ''"
          @click="onSecondClick"
        />
      </UTooltip>

      <UTooltip :text="ballotCheck.ok ? '对当前动议投票' : ballotCheck.reason">
        <UButton
          block
          :label="voteProgress ? `投票（${voteProgress.voted}/${voteProgress.total}）` : '投票'"
          icon="i-lucide-vote"
          variant="soft"
          color="warning"
          :disabled="!ballotCheck.ok"
          :class="meeting.recordMode ? 'border-dashed' : ''"
          @click="onVoteClick"
        />
      </UTooltip>

      <div class="flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-2 text-xs text-muted">
        <UIcon name="i-lucide-lightbulb" class="mt-0.5 size-3.5 shrink-0" />
        <span>{{ hint }}</span>
      </div>
    </div>

    <!-- 实时日志流 -->
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted">
        <UIcon name="i-lucide-activity" class="size-3.5" />
        实时日志
        <span class="ml-auto">{{ meetingState.logs.length }} 条</span>
      </div>
      <div ref="logList" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        <div v-if="!meetingState.logs.length" class="rounded-md border border-dashed border-default p-3 text-center text-xs text-dimmed">
          会议操作将实时记录在这里
        </div>
        <div
          v-for="entry in meetingState.logs"
          :key="entry.id"
          class="flex items-start gap-1.5 text-xs leading-relaxed"
        >
          <UIcon :name="entry.icon" class="mt-0.5 size-3.5 shrink-0" :class="toneClass[entry.tone]" />
          <div class="min-w-0 flex-1">
            <span class="text-dimmed">{{ formatTime(entry.at) }}</span>
            <span class="ml-1" :class="toneClass[entry.tone]">{{ entry.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
