<script setup lang="ts">
import type { AgendaItem, VoteResult } from '#shared/utils/mettings';
import { AgendaItemStatusMap } from '#shared/utils/mettings';

const meeting = computed(() => meetingState.meeting);

const summary = computed(() => {
  const m = meeting.value;
  return {
    motions: m.motions.length,
    votes: m.votes.length,
    passed: m.votes.filter((v: VoteResult) => v.passed).length,
    rejected: m.votes.filter((v: VoteResult) => !v.passed).length,
    agendaPassed: m.agenda.filter((a: AgendaItem) => a.status === AgendaItemStatusMap.PASSED).length,
  };
});
</script>

<template>
  <div class="container">
    <div class="section mx-auto max-w-3xl">
      <div class="section-header">
        <div class="section-title !text-[18px]">
          会议纪要
        </div>
        <div class="section-subtitle">
          「{{ meeting.profile.title }}」已结束。
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="person-card !mb-0 text-center">
          <div class="vote-count">
            {{ summary.motions }}
          </div>
          <div class="person-role">
            动议总数
          </div>
        </div>
        <div class="person-card !mb-0 text-center">
          <div class="vote-count">
            {{ summary.passed }}
          </div>
          <div class="person-role">
            表决通过
          </div>
        </div>
        <div class="person-card !mb-0 text-center">
          <div class="vote-count">
            {{ summary.rejected }}
          </div>
          <div class="person-role">
            表决否决
          </div>
        </div>
        <div class="person-card !mb-0 text-center">
          <div class="vote-count">
            {{ summary.agendaPassed }}/{{ meeting.agenda.length }}
          </div>
          <div class="person-role">
            议题通过
          </div>
        </div>
      </div>

      <template v-if="meeting.votes.length">
        <div class="badge mt-6">
          表决记录
        </div>
        <div
          v-for="vote in meeting.votes"
          :key="vote.id"
          class="vote-display"
        >
          <div>#V{{ vote.id }} · {{ vote.passed ? '通过' : '否决' }}</div>
          <div class="text-[13px] text-[#525252]">
            {{ voteCountDisplay(vote) }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
