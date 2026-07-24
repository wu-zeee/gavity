<script setup lang="ts">
const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const userId = computed(() => uiState.memberDetailId);

const open = computed({
  get: () => userId.value != null,
  set: (v: boolean) => {
    if (!v)
      uiState.memberDetailId = null;
  },
});

const role = computed(() => (userId.value ? roleOf(meeting.value, userId.value) : null));
const stats = computed(() => (userId.value ? memberStats(userId.value) : null));
const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);
const hasFloor = computed(() => userId.value != null && meeting.value.floorHolder === userId.value);

const statItems = computed(() => {
  if (!stats.value)
    return [];
  return [
    { label: '获得发言权', value: stats.value.floorCount },
    { label: '提出动议', value: stats.value.motionCount },
    { label: '附议', value: stats.value.secondCount },
    { label: '参与投票', value: stats.value.voteCount },
  ];
});

const roleLabel = computed(() => {
  if (role.value === 'host')
    return '主持';
  if (role.value === 'member')
    return '成员';
  return '观察员';
});

function run(result: string | null): void {
  if (result) {
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <div class="modal-header">
          与会者详情
        </div>

        <div v-if="userId" class="modal-body">
          <div class="person-card">
            <div class="person-name">
              {{ userName(userId) }}
            </div>
            <div class="person-role">
              {{ roleLabel }}
              <template v-if="hasFloor">
                · 正在发言
              </template>
              <template v-else-if="meeting.floor.includes(userId)">
                · 正在抢夺发言权
              </template>
              <template v-else>
                · 在线
              </template>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div v-for="item in statItems" :key="item.label" class="vote-display !mb-0 !p-4">
              <div class="text-[13px] text-[#525252]">
                {{ item.label }}
              </div>
              <div class="vote-count !text-[24px]">
                {{ item.value }}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer justify-between">
          <div class="flex gap-3">
            <template v-if="userId && role === 'member' && (isHost || meeting.recordMode)">
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="hasFloor"
                @click="run(assignFloor(userId))"
              >
                分配发言权
              </button>
              <button
                v-if="meeting.profile.chair !== userId"
                type="button"
                class="btn btn-secondary"
                @click="run(transferChair(userId))"
              >
                移交主持
              </button>
            </template>
          </div>
          <button type="button" class="btn btn-secondary" @click="open = false">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
