<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const appConfig = useAppConfig();
const themeColors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const themeNeutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'taupe', 'mauve', 'mist', 'olive'];

const themeItems = computed<DropdownMenuItem[]>(() => [{
  label: '主色',
  slot: 'chip',
  chip: appConfig.ui.colors.primary,
  content: { align: 'center', collisionPadding: 16 },
  children: themeColors.map(color => ({
    label: color,
    chip: color,
    slot: 'chip',
    type: 'checkbox',
    checked: appConfig.ui.colors.primary === color,
    onSelect: (e: Event) => {
      e.preventDefault();
      appConfig.ui.colors.primary = color;
    },
  })),
}, {
  label: '中性色',
  slot: 'chip',
  chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
  content: { align: 'end', collisionPadding: 16 },
  children: themeNeutrals.map(color => ({
    label: color,
    chip: color === 'neutral' ? 'old-neutral' : color,
    slot: 'chip',
    type: 'checkbox',
    checked: appConfig.ui.colors.neutral === color,
    onSelect: (e: Event) => {
      e.preventDefault();
      appConfig.ui.colors.neutral = color;
    },
  })),
}]);
</script>

<template>
  <UDropdownMenu :items="themeItems" :content="{ align: 'end', collisionPadding: 12 }">
    <UTooltip text="主题色（仅开发环境）">
      <UButton icon="i-lucide-palette" color="neutral" variant="outline" size="sm" />
    </UTooltip>

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`,
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
