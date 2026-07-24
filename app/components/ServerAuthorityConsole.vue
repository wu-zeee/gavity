<script setup lang="ts">
import type { Meeting } from '#shared/domain/schemas';
import { MeetingStatusMap, MotionTypeMap } from '#shared/domain/schemas';

interface SessionUser {
  id: string
  name: string
  email: string
}

interface MeetingListItem {
  id: number
  title: string
  status: number
  organization_id: string
  role: string
  version: number
  updated_at: number
}

interface AuditEvent {
  sequence: number
  commandId: string
  event: {
    type: string
    occurredAt: number
    actor: { id: string, seatId: string, kind: string }
    payload: Record<string, unknown>
  }
}

const toast = useToast();
const user = ref<SessionUser | null>(null);
const meetings = ref<MeetingListItem[]>([]);
const selectedMeetingId = ref<number | null>(null);
const meeting = ref<Meeting | null>(null);
const version = ref(0);
const events = ref<AuditEvent[]>([]);
const loading = ref(true);
const busy = ref(false);
const authMode = ref<'sign-in' | 'sign-up'>('sign-in');
const credentials = reactive({
  name: '',
  email: '',
  password: '',
});
const motionContent = ref('将 Maker Festival 设备预算上限设为 11,000 元');

const statusLabel = computed(() => ({
  [MeetingStatusMap.NOT_STARTED]: '未开始',
  [MeetingStatusMap.IN_PROGRESS]: '进行中',
  [MeetingStatusMap.VOTING]: '投票中',
  [MeetingStatusMap.RECESSED]: '休会',
  [MeetingStatusMap.ENDED]: '已结束',
})[meeting.value?.status ?? MeetingStatusMap.NOT_STARTED]);
const currentAgendaTitle = computed(() => {
  const currentMeeting = meeting.value;
  return currentMeeting?.agenda.find(item => item.id === currentMeeting.currentAgendaId)?.title ?? '未选择';
});

const canStart = computed(() => meeting.value?.status === MeetingStatusMap.NOT_STARTED);
const holdsFloor = computed(() => meeting.value?.floorHolder === user.value?.id);
const canGrabFloor = computed(() => meeting.value?.status === MeetingStatusMap.IN_PROGRESS
  && meeting.value.floorHolder == null
  && (meeting.value.floorGrabAt == null || meeting.value.floorGrabAt <= Date.now()));

async function loadSession(): Promise<void> {
  try {
    const result = await $fetch<{ user: SessionUser } | null>('/api/auth/get-session');
    user.value = result?.user ?? null;
  } catch {
    user.value = null;
  }
}

async function loadMeetingList(): Promise<void> {
  if (!user.value)
    return;
  const result = await $fetch<{ meetings: MeetingListItem[] }>('/api/meetings');
  meetings.value = result.meetings;
  if (selectedMeetingId.value == null && meetings.value.length)
    selectedMeetingId.value = meetings.value[0]!.id;
  if (selectedMeetingId.value != null)
    await loadMeeting(selectedMeetingId.value);
}

async function loadMeeting(meetingId: number): Promise<void> {
  const [snapshot, history] = await Promise.all([
    $fetch<{ state: Meeting, version: number }>(`/api/meetings/${meetingId}`),
    $fetch<{ events: AuditEvent[] }>(`/api/meetings/${meetingId}/events`),
  ]);
  meeting.value = snapshot.state;
  version.value = snapshot.version;
  events.value = history.events;
}

async function selectMeeting(value: string | number | undefined): Promise<void> {
  if (value == null)
    return;
  selectedMeetingId.value = Number(value);
  await loadMeeting(selectedMeetingId.value);
}

async function submitAuth(): Promise<void> {
  busy.value = true;
  try {
    const path = authMode.value === 'sign-up'
      ? '/api/auth/sign-up/email'
      : '/api/auth/sign-in/email';
    await $fetch(path, {
      method: 'POST',
      body: authMode.value === 'sign-up'
        ? credentials
        : { email: credentials.email, password: credentials.password },
    });
    await loadSession();
    await loadMeetingList();
    toast.add({ title: authMode.value === 'sign-up' ? '账号已创建' : '登录成功', color: 'success' });
  } catch (error) {
    toast.add({ title: '认证失败', description: error instanceof Error ? error.message : '请检查输入', color: 'error' });
  } finally {
    busy.value = false;
  }
}

async function signOut(): Promise<void> {
  await $fetch('/api/auth/sign-out', { method: 'POST' });
  user.value = null;
  meetings.value = [];
  meeting.value = null;
  events.value = [];
}

async function createPersistentMeeting(): Promise<void> {
  busy.value = true;
  try {
    const organization = await $fetch<{ id: string }>('/api/organizations', {
      method: 'POST',
      body: { name: '星河大学创客社' },
    });
    const result = await $fetch<{ state: Meeting, version: number }>('/api/meetings', {
      method: 'POST',
      body: {
        organizationId: organization.id,
        title: 'Maker Festival 预算决策会',
        voteDuration: 60,
        agenda: [{
          title: '设备预算调整',
          details: '确定设备租赁预算和执行负责人',
          scheduledAt: null,
          isSpecial: false,
        }],
      },
    });
    selectedMeetingId.value = result.state.id;
    await loadMeetingList();
    toast.add({ title: '持久化会议已创建', color: 'success' });
  } catch (error) {
    toast.add({ title: '创建失败', description: error instanceof Error ? error.message : '未知错误', color: 'error' });
  } finally {
    busy.value = false;
  }
}

async function executeCommand(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  if (!meeting.value)
    return;
  busy.value = true;
  try {
    const result = await $fetch<{ meeting: { state: Meeting, version: number } }>(
      `/api/meetings/${meeting.value.id}/commands`,
      {
        method: 'POST',
        body: {
          version: 1,
          commandId: crypto.randomUUID(),
          meetingId: meeting.value.id,
          type,
          payload,
        },
      },
    );
    meeting.value = result.meeting.state;
    version.value = result.meeting.version;
    await loadMeeting(meeting.value.id);
  } catch (error) {
    toast.add({ title: '命令被拒绝', description: error instanceof Error ? error.message : '未知错误', color: 'error' });
  } finally {
    busy.value = false;
  }
}

async function proposeMotion(): Promise<void> {
  if (!meeting.value)
    return;
  const motionId = meeting.value.motions.reduce((max, motion) => Math.max(max, motion.id), 0) + 1;
  await executeCommand('PROPOSE_MOTION', {
    motionId,
    motionType: MotionTypeMap.MAIN,
    content: motionContent.value,
    details: '由阶段 3 服务端命令管线创建',
  });
}

onMounted(async () => {
  await loadSession();
  await loadMeetingList();
  loading.value = false;
});
</script>

<template>
  <div class="min-h-screen bg-muted/40 p-6 text-default">
    <div class="mx-auto max-w-6xl space-y-5">
      <header class="flex flex-wrap items-center gap-3 border border-default bg-default p-4">
        <div class="flex size-10 items-center justify-center bg-primary text-inverted">
          <UIcon name="i-lucide-database-zap" class="size-5" />
        </div>
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Gavity · 阶段 3 服务端权威控制台
          </h1>
          <p class="text-sm text-muted">
            所有动作经认证、规则校验、D1 事件日志与投影后才生效
          </p>
        </div>
        <div class="flex-1" />
        <UBadge color="success" variant="soft">
          Server authoritative
        </UBadge>
        <UButton label="返回比赛 Demo" color="neutral" variant="outline" to="/" />
      </header>

      <div v-if="loading" class="border border-default bg-default p-10 text-center text-muted">
        正在读取持久化状态…
      </div>

      <div v-else-if="!user" class="mx-auto max-w-md border border-default bg-default p-6">
        <h2 class="mb-1 text-lg font-semibold">
          {{ authMode === 'sign-up' ? '创建测试账号' : '登录' }}
        </h2>
        <p class="mb-5 text-sm text-muted">
          登录身份由服务端会话决定，客户端不能切换或伪造席位。
        </p>
        <form class="space-y-4" @submit.prevent="submitAuth">
          <UFormField v-if="authMode === 'sign-up'" label="姓名">
            <UInput v-model="credentials.name" required class="w-full" />
          </UFormField>
          <UFormField label="邮箱">
            <UInput v-model="credentials.email" type="email" required class="w-full" />
          </UFormField>
          <UFormField label="密码">
            <UInput v-model="credentials.password" type="password" required minlength="8" class="w-full" />
          </UFormField>
          <UButton
            type="submit"
            block
            :label="authMode === 'sign-up' ? '注册并登录' : '登录'"
            :loading="busy"
          />
        </form>
        <UButton
          class="mt-3"
          block
          color="neutral"
          variant="ghost"
          :label="authMode === 'sign-up' ? '已有账号，去登录' : '没有账号，去注册'"
          @click="authMode = authMode === 'sign-up' ? 'sign-in' : 'sign-up'"
        />
      </div>

      <template v-else>
        <section class="flex flex-wrap items-center gap-3 border border-default bg-default p-4">
          <div>
            <div class="font-medium">
              {{ user.name }}
            </div>
            <div class="text-xs text-muted">
              {{ user.email }} · 身份来自 HttpOnly 会话
            </div>
          </div>
          <div class="flex-1" />
          <USelect
            v-if="meetings.length"
            :model-value="selectedMeetingId ?? undefined"
            :items="meetings.map(item => ({ label: item.title, value: item.id }))"
            class="w-64"
            @update:model-value="selectMeeting"
          />
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" label="从服务端恢复" :disabled="!selectedMeetingId" @click="selectedMeetingId && loadMeeting(selectedMeetingId)" />
          <UButton color="neutral" variant="ghost" label="退出" @click="signOut" />
        </section>

        <div v-if="!meeting" class="border border-dashed border-default bg-default p-12 text-center">
          <UIcon name="i-lucide-calendar-plus" class="mx-auto mb-3 size-8 text-muted" />
          <h2 class="mb-1 font-semibold">
            还没有持久化会议
          </h2>
          <p class="mb-4 text-sm text-muted">
            创建后可关闭浏览器，再次登录时从 D1 恢复。
          </p>
          <UButton label="创建阶段 3 验收会议" :loading="busy" @click="createPersistentMeeting" />
        </div>

        <div v-else class="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <section class="space-y-4 border border-default bg-default p-5">
            <div class="flex flex-wrap items-start gap-3">
              <div>
                <h2 class="text-xl font-semibold">
                  {{ meeting.profile.title }}
                </h2>
                <p class="text-sm text-muted">
                  会议 #{{ meeting.id }} · 投影版本 {{ version }}
                </p>
              </div>
              <div class="flex-1" />
              <UBadge color="primary" variant="soft">
                {{ statusLabel }}
              </UBadge>
            </div>

            <div class="grid gap-3 sm:grid-cols-3">
              <div class="border border-default p-3">
                <div class="text-xs text-muted">
                  当前议题
                </div>
                <div class="mt-1 text-sm font-medium">
                  {{ currentAgendaTitle }}
                </div>
              </div>
              <div class="border border-default p-3">
                <div class="text-xs text-muted">
                  发言权
                </div>
                <div class="mt-1 text-sm font-medium">
                  {{ meeting.floorHolder === user.id ? '由你持有' : meeting.floorHolder ?? '空闲' }}
                </div>
              </div>
              <div class="border border-default p-3">
                <div class="text-xs text-muted">
                  已持久化动议
                </div>
                <div class="mt-1 text-sm font-medium">
                  {{ meeting.motions.length }} 项
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton v-if="canStart" label="开始会议" icon="i-lucide-play" :loading="busy" @click="executeCommand('START_MEETING')" />
              <UButton v-if="canGrabFloor" label="取得发言权" icon="i-lucide-mic" :loading="busy" @click="executeCommand('GRAB_FLOOR')" />
              <UButton v-if="holdsFloor" label="释放发言权" icon="i-lucide-mic-off" color="neutral" variant="outline" :loading="busy" @click="executeCommand('RELEASE_FLOOR')" />
              <UButton
                v-if="meeting.status === MeetingStatusMap.IN_PROGRESS"
                label="结束会议"
                icon="i-lucide-square"
                color="neutral"
                variant="outline"
                :loading="busy"
                @click="executeCommand('END_MEETING')"
              />
            </div>

            <div v-if="holdsFloor" class="space-y-3 border-t border-default pt-4">
              <UFormField label="主动议">
                <UTextarea v-model="motionContent" :rows="3" class="w-full" />
              </UFormField>
              <UButton label="通过服务端提出动议" icon="i-lucide-file-plus-2" :loading="busy" @click="proposeMotion" />
            </div>

            <div class="space-y-2 border-t border-default pt-4">
              <h3 class="text-sm font-semibold">
                当前投影
              </h3>
              <div v-if="!meeting.motions.length" class="border border-dashed border-default p-4 text-sm text-muted">
                暂无动议
              </div>
              <div v-for="motion in meeting.motions" :key="motion.id" class="border border-default p-3">
                <div class="text-xs text-muted">
                  #M{{ motion.id }} · 状态 {{ motion.status }}
                </div>
                <div class="mt-1 font-medium">
                  {{ motion.content }}
                </div>
                <div class="mt-1 text-xs text-muted">
                  actor/提出人：{{ motion.proposer }}
                </div>
              </div>
            </div>
          </section>

          <aside class="border border-default bg-default p-5">
            <div class="mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-list-tree" />
              <h2 class="font-semibold">
                不可变事件历史
              </h2>
              <span class="ml-auto text-xs text-muted">{{ events.length }} 条</span>
            </div>
            <div v-if="!events.length" class="border border-dashed border-default p-4 text-sm text-muted">
              执行命令后，这里会显示服务端事件。
            </div>
            <div class="max-h-[620px] space-y-2 overflow-y-auto">
              <div v-for="item in events" :key="item.sequence" class="border-s-2 border-primary bg-muted/50 p-3">
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span>#{{ item.sequence }}</span>
                  <code>{{ item.event.type }}</code>
                </div>
                <div class="mt-1 text-xs">
                  {{ item.event.actor.kind }} · {{ item.event.actor.seatId }}
                </div>
                <div class="mt-1 truncate text-[11px] text-dimmed" :title="item.commandId">
                  幂等键：{{ item.commandId }}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>
