<script setup lang="ts">
const logListRef = useTemplateRef('logList');

watch(
  () => meetingState.logs.length,
  async () => {
    await nextTick();
    const el = logListRef.value;
    if (el)
      el.scrollTop = el.scrollHeight;
  },
  { flush: 'post' },
);
</script>

<template>
  <div class="section !mb-0">
    <div class="section-header !mb-4 flex items-center justify-between">
      <div class="section-title !mb-0">
        实时日志
      </div>
      <span class="text-[13px] text-[#525252]">{{ meetingState.logs.length }} 条</span>
    </div>
    <div ref="logList" class="scrollbar-thin max-h-64 space-y-1.5 overflow-y-auto">
      <div v-if="!meetingState.logs.length" class="text-[13px] text-[#8a8a8a]">
        会议操作将实时记录在这里
      </div>
      <div
        v-for="entry in meetingState.logs"
        :key="entry.id"
        class="flex items-start gap-1.5 text-[13px] leading-relaxed"
      >
        <UIcon :name="entry.icon" class="mt-0.5 size-3.5 shrink-0 text-[#8a8a8a]" />
        <div class="min-w-0 flex-1">
          <span class="text-[#8a8a8a]">{{ formatTime(entry.at) }}</span>
          <span class="ml-1 text-[#525252]">{{ entry.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
