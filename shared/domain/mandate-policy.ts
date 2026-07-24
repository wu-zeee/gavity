import type { ActorRef, Ballot } from './schemas';
import * as z from 'zod';
import { ActorKindMap, Ballot as BallotSchema } from './schemas';

export const MandateActionMap = {
  PROPOSE: 'propose',
  SECOND: 'second',
  VOTE: 'vote',
  FACILITATE: 'facilitate',
} as const;

export const MandateAction = z.enum(MandateActionMap);
export type MandateAction = z.infer<typeof MandateAction>;

export const DelegateMandate = z.object({
  id: z.string().min(1),
  principalId: z.string().min(1),
  delegateId: z.string().min(1),
  meetingId: z.int(),
  agendaItemIds: z.int().array(),
  actions: MandateAction.array(),
  requiresConfirmation: MandateAction.array().default([]),
  allowedBallots: BallotSchema.array().nullable().default(null),
  effectiveAt: z.int(),
  expiresAt: z.int(),
  revokedAt: z.int().nullable().default(null),
});
export type DelegateMandate = z.infer<typeof DelegateMandate>;

export interface MandateRequest {
  action: MandateAction
  meetingId: number
  agendaItemId: number | null
  at: number
  ballot?: Ballot
}

export type MandateDecision
  = | { status: 'allowed', mandateId: string | null }
    | { status: 'requires-approval', reason: string }
    | { status: 'denied', reason: string };

/**
 * 纯授权策略：只判断结构化授权，不读取私人提示词，也不产生副作用。
 * 越界返回 requires-approval，由应用层创建真人确认请求。
 */
export function evaluateMandate(
  actor: ActorRef,
  request: MandateRequest,
  mandate?: DelegateMandate,
): MandateDecision {
  if (actor.kind !== ActorKindMap.DELEGATE)
    return { status: 'allowed', mandateId: null };

  if (!actor.mandateId || !mandate || mandate.id !== actor.mandateId)
    return { status: 'requires-approval', reason: '数字代表缺少可验证的授权依据' };
  if (mandate.delegateId !== actor.id || mandate.principalId !== actor.seatId)
    return { status: 'denied', reason: '授权主体与当前数字代表席位不匹配' };
  if (mandate.meetingId !== request.meetingId)
    return { status: 'requires-approval', reason: '该授权不适用于当前会议' };
  if (mandate.revokedAt != null)
    return { status: 'denied', reason: '授权已撤销' };
  if (request.at < mandate.effectiveAt || request.at >= mandate.expiresAt)
    return { status: 'requires-approval', reason: '授权尚未生效或已经过期' };
  if (request.agendaItemId != null
    && mandate.agendaItemIds.length
    && !mandate.agendaItemIds.includes(request.agendaItemId)) {
    return { status: 'requires-approval', reason: '该动作超出授权议题范围' };
  }
  if (!mandate.actions.includes(request.action))
    return { status: 'requires-approval', reason: '该动作不在数字代表允许列表中' };
  if (mandate.requiresConfirmation.includes(request.action))
    return { status: 'requires-approval', reason: '该动作需要真人逐次确认' };
  if (request.action === MandateActionMap.VOTE
    && request.ballot !== undefined
    && mandate.allowedBallots
    && !mandate.allowedBallots.includes(request.ballot)) {
    return { status: 'requires-approval', reason: '该票超出数字代表的投票边界' };
  }
  return { status: 'allowed', mandateId: mandate.id };
}
