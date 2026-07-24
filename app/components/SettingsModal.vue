<script setup lang="ts">
const toast = useToast();

const meeting = computed(() => meetingState.meeting);
const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);

const open = computed({
  get: () => uiState.settingsModalOpen,
  set: (v: boolean) => {
    uiState.settingsModalOpen = v;
  },
});

const form = reactive({
  title: '',
  secondsRequired: 2,
  voteDuration: 60,
});

watch(open, (v) => {
  if (v) {
    form.title = meeting.value.profile.title;
    form.secondsRequired = meeting.value.secondsRequired;
    form.voteDuration = meeting.value.voteDuration;
  }
});

/** AI 主持助手（设计稿设置项 → 模拟器开关）。 */
const aiAssistant = computed({
  get: () => botState.running,
  set: (v: boolean) => (v ? startBots() : stopBots()),
});

const canEdit = computed(() => isHost.value || meeting.value.recordMode);

function save(): void {
  const err = updateSettings({ ...form });
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  toast.add({ title: '设置已保存', color: 'success', icon: 'i-lucide-check-circle-2' });
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <div class="modal-header">
          设置
        </div>

        <!-- AI 主持助手（设计稿设置行 → 模拟器开关） -->
        <div class="settings-row">
          <div>
            <div class="settings-label">
              AI 主持助手
            </div>
            <div class="settings-help">
              自动管理发言顺序与计时（模拟其他成员附议与投票）
            </div>
          </div>
          <label class="switch">
            <input v-model="aiAssistant" type="checkbox">
            <span class="slider" />
          </label>
        </div>

        <!-- 会议名称 -->
        <div class="settings-row">
          <div>
            <div class="settings-label">
              会议名称
            </div>
            <div class="settings-help">
              显示在导航栏与纪要中的会议标题
            </div>
          </div>
          <input v-model="form.title" type="text" class="text-input w-56" :disabled="!canEdit">
        </div>

        <!-- 附议人数阈值 -->
        <div class="settings-row">
          <div>
            <div class="settings-label">
              附议人数阈值
            </div>
            <div class="settings-help">
              动议进入辩论所需附议人数
            </div>
          </div>
          <select v-model="form.secondsRequired" class="dropdown-select" :disabled="!canEdit">
            <option :value="1">
              1 人
            </option>
            <option :value="2">
              2 人
            </option>
            <option :value="3">
              3 人
            </option>
          </select>
        </div>

        <!-- 投票时限 -->
        <div class="settings-row">
          <div>
            <div class="settings-label">
              投票时限
            </div>
            <div class="settings-help">
              超时后自动按已投选票结算
            </div>
          </div>
          <select v-model="form.voteDuration" class="dropdown-select" :disabled="!canEdit">
            <option :value="30">
              30 秒
            </option>
            <option :value="60">
              60 秒
            </option>
            <option :value="90">
              90 秒
            </option>
            <option :value="120">
              120 秒
            </option>
          </select>
        </div>

        <div class="modal-footer mt-8">
          <button type="button" class="btn btn-secondary" @click="open = false">
            取消
          </button>
          <button type="button" class="btn btn-primary" :disabled="!canEdit" @click="save">
            保存修改
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
