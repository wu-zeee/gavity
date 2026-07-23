<script setup lang="ts">
import { MeetingStatusMap } from '#shared/utils/mettings';

const toast = useToast();

const statusColor: Record<number, 'neutral' | 'success' | 'warning' | 'info' | 'error'> = {
  [MeetingStatusMap.NOT_STARTED]: 'neutral',
  [MeetingStatusMap.IN_PROGRESS]: 'success',
  [MeetingStatusMap.VOTING]: 'warning',
  [MeetingStatusMap.RECESSED]: 'info',
  [MeetingStatusMap.ENDED]: 'error',
};

const meeting = computed(() => meetingState.meeting);
const statusLabel = computed(() => MEETING_STATUS_LABELS[meeting.value.status]);
const statusBadgeColor = computed(() => statusColor[meeting.value.status] ?? 'neutral');

const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);
const recordMode = computed({
  get: () => meeting.value.recordMode,
  set: () => run(toggleRecordMode()),
});
const recordModeCheck = computed(() => canToggleRecordMode(meeting.value, meetingState.currentUserId));

const identityItems = computed(() => DEMO_USERS.map(u => ({
  label: `${u.name}（${roleLabel(roleOf(meeting.value, u.id))}）`,
  value: u.id,
})));

const endConfirmOpen = ref(false);

function roleLabel(role: 'host' | 'member' | 'observer'): string {
  return role === 'host' ? '主持' : role === 'member' ? '成员' : '观察员';
}

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function onEndMeeting(): void {
  run(endMeeting());
  endConfirmOpen.value = false;
}
</script>

<template>
  <header class="flex items-center gap-3 border-b border-default px-4 py-2.5 shrink-0">
    <div class="flex items-center gap-2 min-w-0">
      <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-inverted">
        <UIcon name="i-lucide-gavel" class="size-5" />
      </div>
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold text-highlighted">
          {{ meeting.profile.title }}
        </div>
        <div class="text-xs text-muted">
          Gavity · 罗伯特议事规则
        </div>
      </div>
    </div>

    <UBadge :color="statusBadgeColor" variant="subtle" size="lg" class="shrink-0">
      {{ statusLabel }}
    </UBadge>

    <div class="flex-1" />

    <UTooltip :text="recordModeCheck.ok ? '解除所有操作限制，自由补录' : recordModeCheck.reason">
      <div class="flex items-center gap-2">
        <span class="text-xs" :class="meeting.recordMode ? 'text-warning font-medium' : 'text-muted'">记录模式</span>
        <USwitch v-model="recordMode" :disabled="!recordModeCheck.ok" size="sm" />
      </div>
    </UTooltip>

    <USeparator orientation="vertical" class="h-6" />

    <USelect
      v-model="meetingState.currentUserId"
      :items="identityItems"
      size="sm"
      class="w-44"
      icon="i-lucide-user-round"
    />

    <template v-if="isHost || meeting.recordMode">
      <UButton
        v-if="meeting.status === MeetingStatusMap.NOT_STARTED"
        label="开始会议"
        icon="i-lucide-play"
        size="sm"
        @click="run(startMeeting())"
      />
      <UButton
        v-if="meeting.status === MeetingStatusMap.RECESSED"
        label="恢复会议"
        icon="i-lucide-play"
        size="sm"
        @click="run(resumeMeeting())"
      />
      <UButton
        v-if="meeting.status === MeetingStatusMap.IN_PROGRESS || meeting.status === MeetingStatusMap.RECESSED"
        label="结束会议"
        icon="i-lucide-square"
        size="sm"
        color="error"
        variant="soft"
        @click="endConfirmOpen = true"
      />
    </template>
    <UButton
      v-if="meeting.status === MeetingStatusMap.ENDED"
      label="重新开始"
      icon="i-lucide-rotate-ccw"
      size="sm"
      variant="soft"
      @click="resetMeeting()"
    />

    <UTooltip text="会议设置">
      <UButton icon="i-lucide-settings" color="neutral" variant="ghost" size="sm" @click="uiState.settingsModalOpen = true" />
    </UTooltip>
    <UTooltip text="帮助">
      <UButton icon="i-lucide-circle-help" color="neutral" variant="ghost" size="sm" @click="uiState.helpModalOpen = true" />
    </UTooltip>

    <UModal v-model:open="endConfirmOpen" title="结束会议" description="结束后会议数据将冻结，是否确认结束？" :ui="{ footer: 'justify-end' }">
      <template #footer="{ close }">
        <UButton label="取消" color="neutral" variant="outline" @click="close" />
        <UButton label="确认结束" color="error" @click="onEndMeeting" />
      </template>
    </UModal>
  </header>
</template>
