<script setup lang="ts">
const toast = useToast();

const meeting = computed(() => meetingState.meeting);

interface Row {
  id: string
  name: string
  role: 'host' | 'member' | 'observer'
  hasFloor: boolean
  grabbing: boolean
  isSelf: boolean
}

const rows = computed<Row[]>(() => {
  const m = meeting.value;
  const ids = [...m.members, ...m.observers];
  return ids.map(id => ({
    id,
    name: userName(id),
    role: roleOf(m, id),
    hasFloor: m.floorHolder === id,
    grabbing: m.floor.includes(id),
    isSelf: id === meetingState.currentUserId,
  }));
});

const canAssign = computed(() => canAssignFloor(meeting.value, meetingState.currentUserId).ok);

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function roleLabel(role: Row['role']): string {
  if (role === 'host')
    return '主持';
  if (role === 'member')
    return '成员';
  return '观察员';
}
</script>

<template>
  <div class="section !mb-0">
    <div class="section-header !mb-4">
      <div class="section-title !mb-0">
        与会者（{{ rows.length }}）
      </div>
    </div>
    <button
      v-for="row in rows"
      :key="row.id"
      type="button"
      class="queue-item !mb-2 w-full text-left"
      @click="uiState.memberDetailId = row.id"
    >
      <div class="flex items-center">
        <div class="avatar mr-3 !size-8" />
        <div>
          <div class="person-name !mb-0 text-[14px]">
            {{ row.name }}<span v-if="row.isSelf" class="text-[#8a8a8a]">（我）</span>
          </div>
          <div class="person-role">
            {{ roleLabel(row.role) }}
            <template v-if="row.hasFloor">
              · 发言中
            </template>
            <template v-else-if="row.grabbing">
              · 抢夺中
            </template>
          </div>
        </div>
      </div>
      <button
        v-if="canAssign && !row.hasFloor && row.role !== 'observer'"
        type="button"
        class="btn btn-secondary btn-icon"
        title="分配发言权"
        @click.stop="run(assignFloor(row.id))"
      >
        <UIcon name="i-lucide-mic" class="size-3.5" />
      </button>
    </button>
  </div>
</template>
