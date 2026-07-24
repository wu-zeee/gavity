<script setup lang="ts">
import type { AgendaItemStatus } from '#shared/utils/mettings';
import { AgendaItemStatusMap } from '#shared/utils/mettings';

const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);
const canEdit = computed(() => isHost.value || meeting.value.recordMode);

const form = reactive({
  title: '',
  voteDuration: 60,
});

const newAgenda = reactive({ title: '', details: '', isSpecial: false });

/** 当前编辑中的议题 id。 */
const editingId = ref<number | null>(null);
const editForm = reactive({ title: '', details: '', scheduledAt: '', isSpecial: false, status: AgendaItemStatusMap.PENDING as AgendaItemStatus });

watch(
  () => uiState.settingsModalOpen,
  (open) => {
    if (open) {
      form.title = meeting.value.profile.title;
      form.voteDuration = meeting.value.voteDuration;
      editingId.value = null;
      newAgenda.title = '';
      newAgenda.details = '';
      newAgenda.isSpecial = false;
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
  newAgenda.isSpecial = false;
}

function removeItem(id: number): void {
  const err = removeAgendaItem(id);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}

function startEdit(item: { id: number, title: string, details: string, scheduledAt: number | null, isSpecial: boolean, status: AgendaItemStatus }): void {
  editingId.value = item.id;
  editForm.title = item.title;
  editForm.details = item.details;
  editForm.scheduledAt = item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '';
  editForm.isSpecial = item.isSpecial;
  editForm.status = item.status;
}

function saveEdit(): void {
  if (editingId.value == null)
    return;
  const scheduledAt = editForm.scheduledAt ? new Date(editForm.scheduledAt).getTime() : null;
  const err = updateAgendaItem(editingId.value, {
    title: editForm.title,
    details: editForm.details,
    scheduledAt,
    isSpecial: editForm.isSpecial,
    status: editForm.status,
  });
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  editingId.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
}

function moveItem(id: number, direction: 'up' | 'down'): void {
  const err = moveAgendaItem(id, direction);
  if (err)
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
}

const durationItems = [30, 60, 90, 120].map(n => ({ label: `${n} 秒`, value: n }));

const statusItems = [
  { label: '待讨论', value: AgendaItemStatusMap.PENDING },
  { label: '讨论中', value: AgendaItemStatusMap.DISCUSSING },
  { label: '已通过', value: AgendaItemStatusMap.PASSED },
  { label: '已否决', value: AgendaItemStatusMap.REJECTED },
];
</script>

<template>
  <UModal v-model:open="uiState.settingsModalOpen" title="会议设置" description="会议基本信息与议事规则配置。" :ui="{ footer: 'justify-end', body: 'max-h-[60vh] overflow-y-auto' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="会议名称">
          <UInput v-model="form.title" :disabled="!canEdit" class="w-full" />
        </UFormField>

        <UFormField label="投票时限" description="超时后自动结算投票">
          <USelect v-model="form.voteDuration" :items="durationItems" :disabled="!canEdit" class="w-full" />
        </UFormField>

        <USeparator label="议程管理" />

        <div class="space-y-1.5">
          <div
            v-for="(item, index) in meeting.agenda"
            :key="item.id"
            class="rounded-none bg-muted px-3 py-1.5 text-sm"
          >
            <!-- 查看模式 -->
            <div v-if="editingId !== item.id" class="flex items-center gap-2">
              <span class="text-dimmed">{{ index + 1 }}.</span>
              <UBadge v-if="item.isSpecial" size="sm" color="primary" variant="soft">
                特别
              </UBadge>
              <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
              <span v-if="item.scheduledAt" class="text-xs text-dimmed">
                {{ new Date(item.scheduledAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
              </span>
              <template v-if="canEdit">
                <UButton icon="i-lucide-chevron-up" color="neutral" variant="outline" size="xs" :disabled="index === 0" @click="moveItem(item.id, 'up')" />
                <UButton icon="i-lucide-chevron-down" color="neutral" variant="outline" size="xs" :disabled="index === meeting.agenda.length - 1" @click="moveItem(item.id, 'down')" />
                <UButton icon="i-lucide-pencil" color="neutral" variant="outline" size="xs" @click="startEdit(item)" />
                <UButton icon="i-lucide-trash-2" color="primary" size="xs" @click="removeItem(item.id)" />
              </template>
            </div>

            <!-- 编辑模式 -->
            <div v-else class="space-y-2 py-1">
              <UInput v-model="editForm.title" placeholder="议题标题" class="w-full" size="sm" />
              <UInput v-model="editForm.details" placeholder="议题说明（可选）" class="w-full" size="sm" />
              <UInput v-model="editForm.scheduledAt" type="datetime-local" placeholder="预定时间（可选）" class="w-full" size="sm" />
              <div class="flex items-center gap-2">
                <USelect v-model="editForm.status" :items="statusItems" class="flex-1" size="sm" />
                <UCheckbox v-model="editForm.isSpecial" label="特别议程" size="sm" />
              </div>
              <div class="flex justify-end gap-1.5">
                <UButton label="取消" color="neutral" variant="outline" size="xs" @click="cancelEdit" />
                <UButton label="保存" size="xs" @click="saveEdit" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="canEdit" class="space-y-2 rounded-none border border-dashed border-default p-3">
          <UInput v-model="newAgenda.title" placeholder="新议题标题" class="w-full" />
          <div class="flex gap-2">
            <UInput v-model="newAgenda.details" placeholder="议题说明（可选）" class="flex-1" />
            <UCheckbox v-model="newAgenda.isSpecial" label="特别议程" />
            <UButton label="添加" icon="i-lucide-plus" :disabled="!newAgenda.title.trim()" @click="addItem" />
          </div>
        </div>

        <USeparator label="与会者" />

        <div class="space-y-1.5">
          <div
            v-for="user in [...meeting.members, ...meeting.observers]"
            :key="user"
            class="flex items-center gap-2 rounded-none bg-muted px-3 py-1.5 text-sm"
          >
            <UAvatar :alt="userName(user)" size="2xs" />
            <span class="flex-1">{{ userName(user) }}</span>
            <UBadge size="sm" variant="subtle" :color="meeting.profile.chair === user ? 'primary' : 'neutral'">
              {{ meeting.profile.chair === user ? '主持' : meeting.members.includes(user) ? '成员' : '观察员' }}
            </UBadge>
          </div>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="outline" @click="close" />
      <UButton label="保存设置" :disabled="!canEdit" @click="save" />
    </template>
  </UModal>
</template>
