<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { MotionType } from '#shared/utils/mettings';
import * as z from 'zod';
import { MotionCategoryMap } from '#shared/utils/mettings';

const toast = useToast();

const schema = z.object({
  type: z.int({ error: '请选择动议类型' }),
  content: z.string().min(1, '请填写动议内容'),
  details: z.string(),
});

type Schema = z.output<typeof schema>;

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

interface SelectItem {
  label: string
  value: MotionType
  disabled?: boolean
  type?: 'label'
}

/** 按类别分组的动议类型选项，不满足提出条件的禁用。 */
const typeItems = computed<SelectItem[]>(() => {
  const items: SelectItem[] = [];
  for (const category of CATEGORY_ORDER) {
    items.push({ label: MOTION_CATEGORY_LABELS[category], value: -1 as MotionType, type: 'label', disabled: true });
    for (const meta of Object.values(MOTION_META)) {
      if (meta.category !== category)
        continue;
      const check = canProposeMotion(meeting.value, meetingState.currentUserId, meta.type);
      items.push({
        label: check.ok ? meta.label : `${meta.label}（${check.reason}）`,
        value: meta.type,
        disabled: !check.ok,
      });
    }
  }
  return items;
});

const selectedMeta = computed(() => (state.type != null ? motionMeta(state.type as MotionType) : null));

function onSubmit(event: FormSubmitEvent<Schema>): void {
  const err = proposeMotion({
    type: event.data.type as MotionType,
    content: event.data.content,
    details: event.data.details,
  });
  if (err) {
    toast.add({ title: err, color: 'error', icon: 'i-lucide-circle-alert' });
    return;
  }
  uiState.motionModalOpen = false;
  state.type = undefined;
  state.content = '';
  state.details = '';
}
</script>

<template>
  <UModal v-model:open="uiState.motionModalOpen" title="提出动议" description="选择动议类型并填写内容，部分动议无需发言权。" :ui="{ footer: 'justify-end' }">
    <template #body>
      <UForm id="motion-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField name="type" label="动议类型" required>
          <USelectMenu
            v-model="state.type"
            :items="typeItems"
            value-key="value"
            placeholder="请选择动议类型"
            class="w-full"
          />
        </UFormField>

        <div v-if="selectedMeta" class="space-y-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted">
          <p>{{ selectedMeta.description }}</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge size="sm" color="neutral" variant="subtle">
              {{ selectedMeta.needsFloor ? '需要发言权' : '无需发言权' }}
            </UBadge>
            <UBadge v-if="selectedMeta.chairRules" size="sm" color="secondary" variant="subtle">
              由主持直接裁决
            </UBadge>
            <UBadge v-else-if="selectedMeta.needsSecond" size="sm" color="info" variant="subtle">
              需要 1 人附议
            </UBadge>
            <UBadge v-if="!selectedMeta.chairRules" size="sm" color="neutral" variant="subtle">
              {{ selectedMeta.threshold === 2 ? '三分之二多数' : selectedMeta.threshold === 3 ? '全体一致' : '简单多数' }}通过
            </UBadge>
            <UBadge v-if="selectedMeta.debatable" size="sm" color="neutral" variant="subtle">
              可辩论
            </UBadge>
          </div>
        </div>

        <UFormField name="content" label="动议内容" required>
          <UTextarea v-model="state.content" :rows="2" autoresize placeholder="例如：通过 2025 年度财务报告" class="w-full" />
        </UFormField>

        <UFormField name="details" label="说明" hint="可选">
          <UTextarea v-model="state.details" :rows="2" autoresize placeholder="补充背景、理由或具体条款" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="outline" @click="close" />
      <UButton type="submit" form="motion-form" label="提交动议" icon="i-lucide-send" />
    </template>
  </UModal>
</template>
