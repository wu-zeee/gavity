import type { z } from 'zod';
import type {
  AddOrganizationMemberInput,
  CreateMandateInput,
  CreateMeetingInput,
  CreateOrganizationInput,
} from '../../shared/contracts/meetings';
import type { Meeting } from '../../shared/domain/schemas';
import {
  AgendaItemStatusMap,
  MeetingStatusMap,
} from '../../shared/domain/schemas';

type CreateOrganizationData = z.infer<typeof CreateOrganizationInput>;
type AddOrganizationMemberData = z.infer<typeof AddOrganizationMemberInput>;
type CreateMeetingData = z.infer<typeof CreateMeetingInput>;
type CreateMandateData = z.infer<typeof CreateMandateInput>;

interface OrganizationMembershipRow {
  role: 'owner' | 'member' | 'observer'
}

interface OrganizationMemberRow {
  user_id: string
  role: 'owner' | 'member' | 'observer'
}

async function requireOrganizationOwner(
  database: D1Database,
  organizationId: string,
  userId: string,
): Promise<void> {
  const membership = await database.prepare(`
    SELECT role FROM organization_members
    WHERE organization_id = ? AND user_id = ?
  `).bind(organizationId, userId).first<OrganizationMembershipRow>();
  if (membership?.role !== 'owner')
    throw new CatalogError('forbidden', '只有组织召集人可以执行该操作');
}

async function nextMeetingId(database: D1Database): Promise<number> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = crypto.getRandomValues(new Uint32Array(1))[0]! % 2_000_000 + 1;
    const existing = await database.prepare('SELECT 1 AS found FROM meetings WHERE id = ?')
      .bind(id)
      .first<{ found: number }>();
    if (!existing)
      return id;
  }
  throw new CatalogError('conflict', '暂时无法分配会议编号，请重试');
}

export class CatalogError extends Error {
  constructor(
    readonly code: 'forbidden' | 'not-found' | 'conflict',
    message: string,
  ) {
    super(message);
  }
}

export async function createOrganization(
  database: D1Database,
  userId: string,
  input: CreateOrganizationData,
) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await database.batch([
    database.prepare(`
      INSERT INTO organizations (id, name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, input.name, userId, now, now),
    database.prepare(`
      INSERT INTO organization_members (organization_id, user_id, role, created_at)
      VALUES (?, ?, 'owner', ?)
    `).bind(id, userId, now),
  ]);
  return { id, name: input.name, role: 'owner' as const };
}

export async function getOrganization(
  database: D1Database,
  userId: string,
  organizationId: string,
) {
  const membership = await database.prepare(`
    SELECT role FROM organization_members
    WHERE organization_id = ? AND user_id = ?
  `).bind(organizationId, userId).first<OrganizationMembershipRow>();
  if (!membership)
    throw new CatalogError('forbidden', '无权访问该组织');

  const organization = await database.prepare(`
    SELECT id, name, created_by, created_at, updated_at
    FROM organizations WHERE id = ?
  `).bind(organizationId).first();
  if (!organization)
    throw new CatalogError('not-found', '组织不存在');
  const members = await database.prepare(`
    SELECT om.user_id, om.role, u.name, u.email
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ?
    ORDER BY om.created_at ASC
  `).bind(organizationId).all();
  return { organization, membership, members: members.results };
}

export async function addOrganizationMember(
  database: D1Database,
  actorUserId: string,
  organizationId: string,
  input: AddOrganizationMemberData,
) {
  await requireOrganizationOwner(database, organizationId, actorUserId);
  const user = await database.prepare('SELECT id FROM users WHERE id = ?')
    .bind(input.userId)
    .first<{ id: string }>();
  if (!user)
    throw new CatalogError('not-found', '待邀请用户不存在');
  await database.prepare(`
    INSERT INTO organization_members (organization_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = excluded.role
  `).bind(organizationId, input.userId, input.role, Date.now()).run();
  return { organizationId, userId: input.userId, role: input.role };
}

export async function createMeeting(
  database: D1Database,
  userId: string,
  input: CreateMeetingData,
) {
  await requireOrganizationOwner(database, input.organizationId, userId);
  const memberResult = await database.prepare(`
    SELECT user_id, role FROM organization_members
    WHERE organization_id = ?
    ORDER BY created_at ASC
  `).bind(input.organizationId).all<OrganizationMemberRow>();
  const organizationMembers = memberResult.results;
  const meetingId = await nextMeetingId(database);
  const now = Date.now();
  const agenda = input.agenda.map((item, index) => ({
    id: meetingId * 1_000 + index + 1,
    title: item.title,
    details: item.details,
    status: AgendaItemStatusMap.PENDING,
    scheduledAt: item.scheduledAt,
    isSpecial: item.isSpecial,
  }));
  const memberIds = organizationMembers
    .filter(member => member.role !== 'observer')
    .map(member => member.user_id);
  const observerIds = organizationMembers
    .filter(member => member.role === 'observer')
    .map(member => member.user_id);
  const state: Meeting = {
    schema: 1,
    id: meetingId,
    profile: { title: input.title, chair: userId },
    status: MeetingStatusMap.NOT_STARTED,
    recordMode: false,
    floor: [],
    floorHolder: null,
    floorGrabAt: null,
    members: memberIds,
    observers: observerIds,
    agenda,
    currentAgendaId: agenda[0]?.id ?? null,
    motions: [],
    votes: [],
    activeVote: null,
    voteDuration: input.voteDuration,
    startedAt: null,
  };

  const statements: D1PreparedStatement[] = [
    database.prepare(`
      INSERT INTO meetings (
        id, organization_id, title, chair_user_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(meetingId, input.organizationId, input.title, userId, state.status, now, now),
    database.prepare(`
      INSERT INTO meeting_projections (
        meeting_id, version, base_state_json, state_json, updated_at
      ) VALUES (?, 0, ?, ?, ?)
    `).bind(meetingId, JSON.stringify(state), JSON.stringify(state), now),
  ];
  for (const [index, item] of agenda.entries()) {
    statements.push(database.prepare(`
      INSERT INTO agenda_items (
        id, meeting_id, position, title, details, status, scheduled_at, is_special
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id,
      meetingId,
      index,
      item.title,
      item.details,
      item.status,
      item.scheduledAt,
      item.isSpecial ? 1 : 0,
    ));
  }
  for (const member of organizationMembers) {
    statements.push(database.prepare(`
      INSERT INTO meeting_participants (
        meeting_id, user_id, seat_id, role, attendance_mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      meetingId,
      member.user_id,
      member.user_id,
      member.user_id === userId ? 'chair' : member.role,
      member.role === 'observer' ? 'observer' : 'human',
      now,
    ));
  }
  await database.batch(statements);
  return { state, version: 0 };
}

export async function listMeetings(
  database: D1Database,
  userId: string,
) {
  const result = await database.prepare(`
    SELECT m.id, m.title, m.status, m.organization_id, mp.role,
      p.version, m.updated_at
    FROM meeting_participants mp
    JOIN meetings m ON m.id = mp.meeting_id
    JOIN meeting_projections p ON p.meeting_id = m.id
    WHERE mp.user_id = ?
    ORDER BY m.updated_at DESC
  `).bind(userId).all();
  return { meetings: result.results };
}

export async function createMandate(
  database: D1Database,
  userId: string,
  meetingId: number,
  input: CreateMandateData,
) {
  const participant = await database.prepare(`
    SELECT role FROM meeting_participants
    WHERE meeting_id = ? AND user_id = ?
  `).bind(meetingId, userId).first<{ role: string }>();
  if (!participant || participant.role === 'observer')
    throw new CatalogError('forbidden', '只有有表决席位的成员可以创建数字代表授权');
  if (input.expiresAt <= input.effectiveAt)
    throw new CatalogError('conflict', '授权到期时间必须晚于生效时间');

  const id = crypto.randomUUID();
  await database.prepare(`
    INSERT INTO delegate_mandates (
      id, meeting_id, principal_id, delegate_id, agenda_item_ids, actions,
      requires_confirmation, allowed_ballots, goal, preferences, prohibitions,
      effective_at, expires_at, revoked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).bind(
    id,
    meetingId,
    userId,
    input.delegateId,
    JSON.stringify(input.agendaItemIds),
    JSON.stringify(input.actions),
    JSON.stringify(input.requiresConfirmation),
    input.allowedBallots == null ? null : JSON.stringify(input.allowedBallots),
    input.goal,
    input.preferences,
    JSON.stringify(input.prohibitions),
    input.effectiveAt,
    input.expiresAt,
    Date.now(),
  ).run();
  return { id, meetingId, principalId: userId, ...input };
}

export async function revokeMandate(
  database: D1Database,
  userId: string,
  meetingId: number,
  mandateId: string,
) {
  const result = await database.prepare(`
    UPDATE delegate_mandates
    SET revoked_at = ?
    WHERE id = ? AND meeting_id = ? AND principal_id = ? AND revoked_at IS NULL
  `).bind(Date.now(), mandateId, meetingId, userId).run();
  if (result.meta.changes !== 1)
    throw new CatalogError('not-found', '可撤销的授权不存在');
  return { id: mandateId, revoked: true };
}
