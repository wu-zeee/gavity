<script setup lang="ts">
const meeting = computed(() => meetingState.meeting);

const motion = computed(() => {
  const id = meetingState.pendingRulingMotionId;
  return id != null ? meeting.value.motions.find(m => m.id === id) ?? null : null;
});

const open = computed(() => motion.value != null && meeting.value.profile.chair === meetingState.currentUserId);

function rule(uphold: boolean): void {
  resolveRuling(uphold);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && motion" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          主持裁决
        </div>

        <div class="modal-body">
          <div class="person-card">
            <div class="person-name">
              {{ motionMeta(motion.type).label }}
            </div>
            <div class="person-role">
              @{{ userName(motion.proposer) }} 提出
            </div>
            <p class="mt-3 text-[14px] text-[#0a0a0a]">
              {{ motion.content }}
            </p>
            <p v-if="motion.details" class="mt-1 text-[13px] text-[#525252]">
              {{ motion.details }}
            </p>
          </div>
          <p class="text-[13px]">
            请主持裁定该事项是否成立。成立后按议事规则处理，不成立则予以驳回。
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="rule(false)">
            不成立
          </button>
          <button type="button" class="btn btn-primary" @click="rule(true)">
            裁决成立
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
