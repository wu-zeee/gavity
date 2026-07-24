import type { VoteTreshold } from '#shared/utils/mettings';
import { VoteTresholdMap } from '#shared/utils/mettings';

/** 弹窗等全局 UI 状态（非会议数据）。 */
export const uiState = reactive({
  motionModalOpen: false,
  voteModalOpen: false,
  settingsModalOpen: false,
  helpModalOpen: false,
  memberDetailId: null as string | null,
});

/** 表决阈值中文标签。 */
export function thresholdLabel(threshold: VoteTreshold): string {
  if (threshold === VoteTresholdMap.TWO_THIRDS)
    return '三分之二多数';
  if (threshold === VoteTresholdMap.UNANIMOUS)
    return '全体一致';
  return '简单多数';
}

/** 操作失败时弹出错误 toast；成功（null）时无操作。 */
export function notifyError(result: string | null): void {
  if (!result)
    return;
  const toast = useToast();
  toast.add({ title: result, color: 'error', icon: 'i-lucide-circle-alert' });
}
