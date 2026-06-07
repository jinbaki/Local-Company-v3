import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "../config.js";

export interface DatabaseContext {
  db: DatabaseSync;
  config: AppConfig;
}

const migrations: Array<{ id: string; sql: string }> = [
  {
    id: "001_v3_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        instruction TEXT NOT NULL,
        pm_summary TEXT NOT NULL DEFAULT '',
        max_parallel_workers INTEGER NOT NULL DEFAULT 3,
        max_attempts_per_task INTEGER NOT NULL DEFAULT 2,
        max_total_minutes INTEGER NOT NULL DEFAULT 120,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
      );

      CREATE TABLE IF NOT EXISTS references_store (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        content_path TEXT NOT NULL,
        content_preview TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS pm_plans (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        validated_json TEXT NOT NULL,
        status TEXT NOT NULL,
        validation_errors TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        mission TEXT NOT NULL,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version_id TEXT,
        review_summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        worker_id TEXT,
        title TEXT NOT NULL,
        instructions TEXT NOT NULL,
        acceptance_criteria TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        attempt INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 2,
        depends_on TEXT NOT NULL DEFAULT '[]',
        artifact_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id),
        FOREIGN KEY (worker_id) REFERENCES workers(id)
      );

      CREATE TABLE IF NOT EXISTS artifact_versions (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        source_worker_run_id TEXT,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
      );

      CREATE TABLE IF NOT EXISTS worker_runs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        worker_id TEXT,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_path TEXT NOT NULL DEFAULT '',
        output_path TEXT NOT NULL DEFAULT '',
        error_path TEXT NOT NULL DEFAULT '',
        error_summary TEXT NOT NULL DEFAULT '',
        started_at TEXT,
        finished_at TEXT,
        exit_code INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (worker_id) REFERENCES workers(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        result TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id),
        FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        client_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        reason TEXT NOT NULL,
        options TEXT NOT NULL,
        recommended_option TEXT NOT NULL,
        status TEXT NOT NULL,
        answer TEXT,
        blocks TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        run_id TEXT,
        artifact_id TEXT,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_runs_campaign ON runs(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_run ON tasks(run_id);
      CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
    `
  }
];

export function createDatabaseContext(config: AppConfig): DatabaseContext {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const dbPath = path.join(config.dataDir, "local-company-v3.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );

  for (const migration of migrations) {
    const existing = db.prepare("SELECT id FROM migrations WHERE id = ?").get(migration.id);
    if (!existing) {
      db.exec(migration.sql);
      db.prepare("INSERT INTO migrations (id) VALUES (?)").run(migration.id);
    }
  }

  return { db, config };
}
