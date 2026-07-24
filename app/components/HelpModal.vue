<script setup lang="ts">
const open = computed({
  get: () => uiState.helpModalOpen,
  set: (v: boolean) => {
    uiState.helpModalOpen = v;
  },
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <div class="modal-header">
          帮助与文档
        </div>
        <div class="modal-body">
          <p>本系统基于罗伯特议事规则实现正式会议流程。</p>
          <br>
          <p><strong class="text-[#0a0a0a]">核心流程：</strong></p>
          <ol class="ml-5 mt-3 list-decimal space-y-1">
            <li>成员举手申请发言</li>
            <li>动议获得附议</li>
            <li>主持复述动议</li>
            <li>成员展开辩论</li>
            <li>进行投票表决</li>
            <li>宣布表决结果</li>
          </ol>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="open = false">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
