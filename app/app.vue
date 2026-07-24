<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale';

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

useHead({ title: 'Gavity 会议控制台' });
</script>

<template>
  <UApp :locale="zh_cn">
    <div class="flex h-screen flex-col bg-default text-default">
      <MeetingTopBar />

      <UAlert
        v-if="meetingState.meeting.recordMode"
        color="primary"
        variant="soft"
        icon="i-lucide-pencil-line"
        title="记录模式已开启，操作限制已解除"
        class="rounded-none"
      />

      <div class="relative flex min-h-0 flex-1">
        <MemberList />
        <main class="flex min-h-0 flex-1 flex-col bg-muted/40">
          <StageArea />
        </main>
        <aside class="min-h-0 w-[340px] shrink-0 border-s border-default">
          <ActionPanel />
        </aside>
      </div>
    </div>

    <DevOnly>
      <div class="fixed bottom-4 right-4 z-50">
        <ThemePicker />
      </div>
    </DevOnly>

    <MotionModal />
    <VoteModal />
    <SettingsModal />
    <MemberDetailModal />
    <HelpModal />
    <RulingModal />
  </UApp>
</template>
