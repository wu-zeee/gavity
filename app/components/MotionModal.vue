<script setup lang="ts">
import type { MotionType } from '#shared/utils/mettings';
import { MotionCategoryMap } from '#shared/utils/mettings';

const toast = useToast();

const open = computed({
  get: () => uiState.motionModalOpen,
  set: (v: boolean) => {
    uiState.motionModalOpen = v;
  },
});

const state = reactive<{ type?: MotionType, content: string, details: string }>({
  type: undefined,
  content: '',
  details: '',
});

const meeting = computed(() => meetingState.meeting);

const CATEGORY_ORDER = [
  MotionCategoryMap.MAIN,
  MotionCategoryMap.SUBSIDIARY,
  MotionCategoryMap.PRIVILEGED,
  MotionCategoryMap.INCIDENTAL,
  MotionCategoryMap.RESTORATIVE,
] as const;

/** 按类别分组的动议类型（原生 select optgroup），不满足提出条件的禁用并附原因。 */
const typeGroups = computed(() =>
  CATEGORY_ORDER.map(category => ({
    label: MOTION_CATEGORY_LABELS[category],
    options: Object.values(MOTION_META)
      .filter(meta => meta.category === category)
      .map((meta) => {
        const check = canProposeMotion(meeting.value, meetingState.currentUserId, meta.type);
        return {
          label: check.ok ? meta.label : `${meta.label}（${check.reason}）`,
          value: meta.type,
          disabled: !check.ok,
        };
      }),
  })),
);

const selectedMeta = computed(() => (state.type != null ? motionMeta(state.type as MotionType) : null));

const valid = computed(() => state.type != null && state.content.trim().length > 0);

function onSubmit(): void {
  if (!valid.value)
    return;
  const err = proposeMotion({
    type: state.type as MotionType,
    content: state.content,
    details: state.details,
  });
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  open.value = false;
  state.type = undefined;
  state.content = '';
  state.details = '';
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <div class="modal-header">
          提出动议
        </div>

        <div class="modal-body">
          <div class="mb-4">
            <div class="settings-label mb-2">
              动议类型 *
            </div>
            <select v-model="state.type" class="dropdown-select w-full">
              <option :value="undefined" disabled>
                请选择动议类型
              </option>
              <optgroup v-for="group in typeGroups" :key="group.label" :label="group.label">
                <option v-for="opt in group.options" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
                  {{ opt.label }}
                </option>
              </optgroup>
            </select>
          </div>

          <div v-if="selectedMeta" class="person-card !mb-4">
            <div class="person-role !text-[#525252]">
              {{ selectedMeta.description }}
            </div>
            <div class="mt-2 text-[13px] text-[#525252]">
              {{ selectedMeta.needsFloor ? '需要发言权' : '无需发言权' }}
              <template v-if="selectedMeta.chairRules">
                · 由主持直接裁决
              </template>
              <template v-else-if="selectedMeta.needsSecond">
                · 需要 {{ meeting.secondsRequired }} 人附议
              </template>
              <template v-if="!selectedMeta.chairRules">
                · {{ selectedMeta.threshold === 2 ? '三分之二多数' : selectedMeta.threshold === 3 ? '全体一致' : '简单多数' }}通过
              </template>
              <template v-if="selectedMeta.debatable">
                · 可辩论
              </template>
            </div>
          </div>

          <div class="mb-4">
            <div class="settings-label mb-2">
              动议内容 *
            </div>
            <textarea v-model="state.content" rows="2" class="text-input w-full" placeholder="例如：通过 2025 年度财务报告" />
          </div>

          <div>
            <div class="settings-label mb-2">
              说明（可选）
            </div>
            <textarea v-model="state.details" rows="2" class="text-input w-full" placeholder="补充背景、理由或具体条款" />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="open = false">
            取消
          </button>
          <button type="button" class="btn btn-primary" :disabled="!valid" @click="onSubmit">
            提交动议
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
