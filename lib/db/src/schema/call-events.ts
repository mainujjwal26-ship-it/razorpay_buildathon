import { sql } from "drizzle-orm";
import { pgTable, bigserial, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Queryable call events, not uploaded files or audio bytes.
export const callEventsTable = pgTable("call_events", {
  sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
  eventId: uuid("event_id").notNull().defaultRandom().unique(),
  callId: text("call_id").notNull(),
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  event: jsonb("event").$type<Record<string, unknown>>().notNull(),
}, (t) => [
  index("call_events_call_order_idx").on(t.callId, t.occurredAt, t.sequence),
  uniqueIndex("call_events_lifecycle_unique").on(t.callId, t.type)
    .where(sql`${t.type} in ('call_start', 'call_end', 'call_review')`),
]);

export const insertCallEventSchema = createInsertSchema(callEventsTable).omit({ sequence: true });
export type CallEvent = typeof callEventsTable.$inferSelect;
export type InsertCallEvent = typeof callEventsTable.$inferInsert;
