import type { DatabaseSync } from "node:sqlite";
import type { ListNotificationsResponse, MarkNotificationsSeenResponse, NotificationSummary } from "../../shared/types.js";
import { createId } from "./ids.js";

const lastSeenKey = "notifications.lastSeenSequence";

interface NotificationRow {
  sequence: number;
  id: string;
  type: string;
  runId: string | null;
  artifactId: string | null;
  title: string;
  summary: string;
  createdAt: string;
}

function getMetaNumber(db: DatabaseSync, key: string): number {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as { value: string } | undefined;
  const parsed = Number.parseInt(row?.value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function setMetaNumber(db: DatabaseSync, key: string, value: number): void {
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, String(Math.max(0, Math.floor(value))));
}

export function createNotification(input: {
  db: DatabaseSync;
  type: string;
  runId?: string | null;
  artifactId?: string | null;
  title: string;
  summary: string;
}): void {
  input.db
    .prepare(
      `INSERT INTO notifications (id, type, run_id, artifact_id, title, summary)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(createId("notification"), input.type, input.runId ?? null, input.artifactId ?? null, input.title, input.summary);
}

function latestSequence(db: DatabaseSync): number {
  const row = db.prepare("SELECT COALESCE(MAX(rowid), 0) AS sequence FROM notifications").get() as { sequence: number } | undefined;
  return row?.sequence ?? 0;
}

function unseenCount(db: DatabaseSync, lastSeenSequence: number): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE rowid > ?").get(lastSeenSequence) as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

function rowToNotification(row: NotificationRow, lastSeenSequence: number): NotificationSummary {
  return {
    sequence: row.sequence,
    id: row.id,
    type: row.type,
    runId: row.runId,
    artifactId: row.artifactId,
    title: row.title,
    summary: row.summary,
    createdAt: row.createdAt,
    seen: row.sequence <= lastSeenSequence
  };
}

export function listNotifications(
  db: DatabaseSync,
  input: { afterSequence?: number; limit?: number; includeSeen?: boolean } = {}
): ListNotificationsResponse {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  const lastSeenSequence = getMetaNumber(db, lastSeenKey);
  const afterSequence = input.afterSequence ?? (input.includeSeen ? 0 : lastSeenSequence);
  const rows = db
    .prepare(
      `SELECT
        rowid AS sequence,
        id,
        type,
        run_id AS runId,
        artifact_id AS artifactId,
        title,
        summary,
        created_at AS createdAt
       FROM notifications
       WHERE rowid > ?
       ORDER BY rowid ASC
       LIMIT ?`
    )
    .all(afterSequence, limit) as unknown as NotificationRow[];

  return {
    notifications: rows.map((row) => rowToNotification(row, lastSeenSequence)),
    latestSequence: latestSequence(db),
    lastSeenSequence,
    unseenCount: unseenCount(db, lastSeenSequence)
  };
}

export function markNotificationsSeen(db: DatabaseSync, sequence?: number): MarkNotificationsSeenResponse {
  const latest = latestSequence(db);
  const current = getMetaNumber(db, lastSeenKey);
  const next = Math.max(current, Math.min(sequence ?? latest, latest));
  setMetaNumber(db, lastSeenKey, next);

  return {
    lastSeenSequence: next,
    unseenCount: unseenCount(db, next),
    message: "알림 확인 위치를 저장했습니다."
  };
}
