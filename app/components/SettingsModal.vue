<script setup lang="ts">
const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);

const form = reactive({
  title: '',
  secondsRequired: 2,
  voteDuration: 60,
});

const newAgenda = reactive({ title: '', details: '' });

watch(
  () => uiState.settingsModalOpen,
  (open) => {
    if (open) {
      form.title = meeting.value.profile.title;
      form.secondsRequired = meeting.value.secondsRequired;
      form.voteDuration = meeting.value.voteDuration;
    }
  },
);

function save(): void {
  const err = updateSettings({ ...form });
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  toast.add({ title: '设置已保存', color: 'success', icon: 'i-lucide-check-circle-2' });
  uiState.settingsModalOpen = false;
}

function addItem(): void {
  if (!newAgenda.title.trim())
    return;
  const err = addAgendaItem(newAgenda.title, newAgenda.details);
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  newAgenda.title = '';
  newAgenda.details = '';
}

function removeItem(id: number): void {
  const err = removeAgendaItem(id);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}

const secondsItems = [1, 2, 3].map(n => ({ label: `${n} 人`, value: n }));
const durationItems = [30, 60, 90, 120].map(n => ({ label: `${n} 秒`, value: n }));
</script>

<template>
  <UModal v-model:open="uiState.settingsModalOpen" title="会议设置" description="会议基本信息与议事规则配置。" :ui="{ footer: 'justify-end', body: 'max-h-[60vh] overflow-y-auto' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="会议名称">
          <UInput v-model="form.title" :disabled="!isHost && !meeting.recordMode" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="附议人数阈值" description="动议进入讨论所需附议人数">
            <USelect v-model="form.secondsRequired" :items="secondsItems" :disabled="!isHost && !meeting.recordMode" class="w-full" />
          </UFormField>
          <UFormField label="投票时限" description="超时后自动结算投票">
            <USelect v-model="form.voteDuration" :items="durationItems" :disabled="!isHost && !meeting.recordMode" class="w-full" />
          </UFormField>
        </div>

        <USeparator label="议程管理" />

        <div class="space-y-1.5">
          <div
            v-for="(item, index) in meeting.agenda"
            :key="item.id"
            class="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
          >
            <span class="text-dimmed">{{ index + 1 }}.</span>
            <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
            <UButton
              v-if="isHost || meeting.recordMode"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              @click="removeItem(item.id)"
            />
          </div>
        </div>

        <div v-if="isHost || meeting.recordMode" class="space-y-2 rounded-lg border border-dashed border-default p-3">
          <UInput v-model="newAgenda.title" placeholder="新议题标题" class="w-full" />
          <div class="flex gap-2">
            <UInput v-model="newAgenda.details" placeholder="议题说明（可选）" class="flex-1" />
            <UButton label="添加" icon="i-lucide-plus" variant="soft" :disabled="!newAgenda.title.trim()" @click="addItem" />
          </div>
        </div>

        <USeparator label="与会者" />

        <div class="space-y-1.5">
          <div
            v-for="user in [...meeting.members, ...meeting.observers]"
            :key="user"
            class="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
          >
            <UAvatar :alt="userName(user)" size="2xs" />
            <span class="flex-1">{{ userName(user) }}</span>
            <UBadge size="sm" variant="subtle" :color="meeting.profile.chair === user ? 'primary' : meeting.members.includes(user) ? 'neutral' : 'warning'">
              {{ meeting.profile.chair === user ? '主持' : meeting.members.includes(user) ? '成员' : '观察员' }}
            </UBadge>
          </div>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="outline" @click="close" />
      <UButton label="保存设置" :disabled="!isHost && !meeting.recordMode" @click="save" />
    </template>
  </UModal>
</template>
