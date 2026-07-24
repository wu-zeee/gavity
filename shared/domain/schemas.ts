import * as z from 'zod';
import { Meeting } from '../utils/mettings';

export * from '../utils/mettings';

/** 领域核心当前使用的权威会议状态 Schema。 */
export const MeetingState = Meeting;
export type MeetingState = z.infer<typeof MeetingState>;

export const ActorKindMap = {
  HUMAN: 'human',
  DELEGATE: 'delegate',
  CHAIR_AGENT: 'chair-agent',
  SYSTEM: 'system',
} as const;

export const ActorKind = z.enum(ActorKindMap);
export type ActorKind = z.infer<typeof ActorKind>;

/**
 * id 标识实际操作者，seatId 标识其在会议中使用的席位。
 * 真人两者相同；数字代表的 seatId 是授权人的席位。
 */
export const ActorRef = z.object({
  id: z.string().min(1),
  seatId: z.string().min(1),
  kind: ActorKind,
  mandateId: z.string().min(1).nullable().default(null),
});
export type ActorRef = z.infer<typeof ActorRef>;
