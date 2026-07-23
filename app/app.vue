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
        color="warning"
        variant="subtle"
        icon="i-lucide-pencil-line"
        title="记录模式已开启，操作限制已解除"
        class="rounded-none"
      />

      <div class="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside class="min-h-0 border-r border-default">
          <MemberList />
        </aside>
        <main class="min-h-0 bg-muted/40">
          <StageArea />
        </main>
        <aside class="min-h-0 border-l border-default">
          <ActionPanel />
        </aside>
      </div>
    </div>

    <MotionModal />
    <VoteModal />
    <SettingsModal />
    <MemberDetailModal />
    <HelpModal />
    <RulingModal />
  </UApp>
</template>
