<script setup lang="ts">
const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const canSwitch = computed(() => canSwitchAgenda(meeting.value, meetingState.currentUserId).ok);

function onSwitch(itemId: number): void {
  if (!canSwitch.value)
    return;
  const err = switchAgenda(itemId);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}
</script>

<template>
  <div class="section !mb-0">
    <div class="section-header !mb-4">
      <div class="section-title !mb-0">
        议程（{{ meeting.agenda.length }}）
      </div>
    </div>
    <button
      v-for="(item, index) in meeting.agenda"
      :key="item.id"
      type="button"
      class="queue-item !mb-2 w-full text-left"
      :class="{ '!bg-[#f0f0f0]': item.id === meeting.currentAgendaId, 'cursor-pointer': canSwitch, 'cursor-default': !canSwitch }"
      @click="onSwitch(item.id)"
    >
      <div class="flex items-center">
        <UIcon :name="AGENDA_STATUS_META[item.status]?.icon ?? 'i-lucide-circle'" class="mr-2 size-4 shrink-0" :class="AGENDA_STATUS_META[item.status]?.class" />
        <div class="person-name !mb-0 text-[14px]">
          {{ index + 1 }}. {{ item.title }}
        </div>
      </div>
      <span class="text-[13px] text-[#525252]">
        {{ item.id === meeting.currentAgendaId ? '当前' : AGENDA_STATUS_META[item.status]?.label }}
      </span>
    </button>
  </div>
</template>
