<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale';
import { MeetingStatusMap } from '#shared/utils/mettings';

onMounted(() => startBots());
onUnmounted(() => stopBots());

// 投票开启时自动弹出投票弹窗（含切换身份后补投）
watch(
  [() => meetingState.meeting.activeVote, () => meetingState.currentUserId],
  ([vote, userId]) => {
    if (vote && vote.ballots[userId] === undefined && isMember(meetingState.meeting, userId)) {
      uiState.voteModalOpen = true;
    }
  },
);

const toast = useToast();
const meeting = computed(() => meetingState.meeting);
const isHost = computed(() => meeting.value.profile.chair === meetingState.currentUserId);

const recordModeCheck = computed(() => canToggleRecordMode(meeting.value, meetingState.currentUserId));
const endConfirmOpen = ref(false);

function run(result: string | null): void {
  if (result)
    toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}

function onEndMeeting(): void {
  run(endMeeting());
  endConfirmOpen.value = false;
}

useHead({ title: 'Gavity 会议控制台' });
</script>

<template>
  <UApp :locale="zh_cn">
    <div class="flex min-h-screen flex-col bg-white text-[#0a0a0a]">
      <!-- 导航栏（设计稿 .navbar；开关/会议控制为同规格新增） -->
      <div class="navbar">
        <div class="logo">
          罗伯特议事规则
        </div>
        <div class="nav-right">
          <!-- 记录模式（设计稿 switch 控件） -->
          <label class="flex items-center gap-2" :title="recordModeCheck.ok ? '解除所有操作限制，自由补录' : recordModeCheck.reason">
            <span class="text-[13px]" :class="meeting.recordMode ? 'font-medium text-[#0a0a0a]' : 'text-[#525252]'">记录模式</span>
            <span class="switch">
              <input type="checkbox" :checked="meeting.recordMode" :disabled="!recordModeCheck.ok" @change="run(toggleRecordMode())">
              <span class="slider" />
            </span>
          </label>

          <!-- 会议控制 -->
          <button
            v-if="(isHost || meeting.recordMode) && meeting.status === MeetingStatusMap.NOT_STARTED"
            type="button"
            class="btn btn-primary"
            @click="run(startMeeting())"
          >
            开始会议
          </button>
          <button
            v-if="(isHost || meeting.recordMode) && meeting.status === MeetingStatusMap.RECESSED"
            type="button"
            class="btn btn-primary"
            @click="run(resumeMeeting())"
          >
            恢复会议
          </button>
          <button
            v-if="(isHost || meeting.recordMode) && (meeting.status === MeetingStatusMap.IN_PROGRESS || meeting.status === MeetingStatusMap.RECESSED)"
            type="button"
            class="btn btn-secondary"
            @click="endConfirmOpen = true"
          >
            结束会议
          </button>
          <button
            v-if="meeting.status === MeetingStatusMap.ENDED"
            type="button"
            class="btn btn-secondary"
            @click="resetMeeting()"
          >
            重新开始
          </button>

          <button type="button" class="btn btn-secondary btn-icon" title="会议数据（议程 / 与会者 / 日志）" @click="uiState.dataPanelOpen = true">
            <UIcon name="i-lucide-panel-right-open" class="size-4" />
          </button>
          <button type="button" class="btn btn-secondary btn-icon" title="帮助" @click="uiState.helpModalOpen = true">
            ?
          </button>
          <button type="button" class="btn btn-secondary btn-icon" title="设置" @click="uiState.settingsModalOpen = true">
            ⚙️
          </button>

          <!-- 用户菜单（身份切换） -->
          <div class="user-menu">
            <div class="avatar" />
            <select v-model="meetingState.currentUserId" class="dropdown-select !cursor-pointer py-1 text-[13px]">
              <option v-for="u in DEMO_USERS" :key="u.id" :value="u.id">
                {{ u.name }}（{{ roleOf(meeting, u.id) === 'host' ? '主持' : roleOf(meeting, u.id) === 'member' ? '成员' : '观察员' }}）
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 记录模式提示（设计稿同规格横幅，新增控件） -->
      <div v-if="meeting.recordMode" class="border-b border-[#e4e4e4] bg-[#fafafa] px-12 py-2 text-[13px] text-[#525252]">
        记录模式已开启，操作限制已解除
      </div>

      <main class="flex-1">
        <ModeratorView v-if="isHost" />
        <MemberView v-else />
      </main>
    </div>

    <!-- Gavity 数据抽屉：议程 / 与会者 / 实时日志 -->
    <USlideover v-model:open="uiState.dataPanelOpen" title="会议数据" description="议程、与会者与实时日志。">
      <template #body>
        <div class="scrollbar-thin space-y-6 overflow-y-auto pb-4">
          <AgendaList />
          <MemberList />
          <LogStream />
        </div>
      </template>
    </USlideover>

    <!-- 结束会议确认（设计稿 modal 规格） -->
    <Teleport to="body">
      <div v-if="endConfirmOpen" class="modal-overlay" @click.self="endConfirmOpen = false">
        <div class="modal">
          <div class="modal-header">
            结束会议
          </div>
          <div class="modal-body">
            结束后会议数据将冻结，是否确认结束？
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="endConfirmOpen = false">
              取消
            </button>
            <button type="button" class="btn btn-primary" @click="onEndMeeting">
              确认结束
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <MotionModal />
    <VoteModal />
    <SettingsModal />
    <MemberDetailModal />
    <HelpModal />
    <RulingModal />
  </UApp>
</template>
