import type { Meeting } from '../../../../shared/domain/schemas';
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { users } from './auth';

function timestamp(name: string) {
  return integer(name, { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();
}

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const organizationMembers = sqliteTable('organization_members', {
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'member', 'observer'] }).notNull(),
  createdAt: timestamp('created_at'),
}, table => [
  primaryKey({ columns: [table.organizationId, table.userId] }),
  index('organization_members_user_idx').on(table.userId),
]);

export const meetings = sqliteTable('meetings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  chairUserId: text('chair_user_id').notNull().references(() => users.id),
  status: integer('status').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
}, table => [
  index('meetings_organization_idx').on(table.organizationId),
]);

export const agendaItems = sqliteTable('agenda_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  details: text('details').notNull().default(''),
  status: integer('status').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
  isSpecial: integer('is_special', { mode: 'boolean' }).notNull().default(false),
}, table => [
  uniqueIndex('agenda_items_meeting_position_uq').on(table.meetingId, table.position),
]);

export const meetingParticipants = sqliteTable('meeting_participants', {
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  seatId: text('seat_id').notNull(),
  role: text('role', { enum: ['chair', 'member', 'observer'] }).notNull(),
  attendanceMode: text('attendance_mode', { enum: ['human', 'delegate', 'observer'] }).notNull(),
  createdAt: timestamp('created_at'),
}, table => [
  primaryKey({ columns: [table.meetingId, table.userId] }),
  uniqueIndex('meeting_participants_seat_uq').on(table.meetingId, table.seatId),
]);

export const delegateMandates = sqliteTable('delegate_mandates', {
  id: text('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  principalId: text('principal_id').notNull().references(() => users.id),
  delegateId: text('delegate_id').notNull(),
  agendaItemIds: text('agenda_item_ids', { mode: 'json' }).$type<number[]>().notNull(),
  actions: text('actions', { mode: 'json' }).$type<string[]>().notNull(),
  requiresConfirmation: text('requires_confirmation', { mode: 'json' }).$type<string[]>().notNull(),
  allowedBallots: text('allowed_ballots', { mode: 'json' }).$type<number[] | null>(),
  goal: text('goal').notNull().default(''),
  preferences: text('preferences').notNull().default(''),
  prohibitions: text('prohibitions', { mode: 'json' }).$type<string[]>().notNull(),
  effectiveAt: integer('effective_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: timestamp('created_at'),
}, table => [
  index('delegate_mandates_meeting_principal_idx').on(table.meetingId, table.principalId),
]);

export const meetingEvents = sqliteTable('meeting_events', {
  id: text('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  commandId: text('command_id').notNull(),
  type: text('type').notNull(),
  version: integer('version').notNull(),
  actorId: text('actor_id').notNull(),
  actorKind: text('actor_kind').notNull(),
  seatId: text('seat_id').notNull(),
  mandateId: text('mandate_id'),
  eventJson: text('event_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  uniqueIndex('meeting_events_meeting_sequence_uq').on(table.meetingId, table.sequence),
  uniqueIndex('meeting_events_meeting_event_uq').on(table.meetingId, table.id),
  index('meeting_events_command_idx').on(table.meetingId, table.commandId),
]);

export const meetingProjections = sqliteTable('meeting_projections', {
  meetingId: integer('meeting_id')
    .primaryKey()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(0),
  baseStateJson: text('base_state_json', { mode: 'json' }).$type<Meeting>().notNull(),
  stateJson: text('state_json', { mode: 'json' }).$type<Meeting>().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [meetings.organizationId],
    references: [organizations.id],
  }),
  agendaItems: many(agendaItems),
  participants: many(meetingParticipants),
  mandates: many(delegateMandates),
  events: many(meetingEvents),
}));
