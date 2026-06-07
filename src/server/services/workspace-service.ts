import type { DatabaseSync } from "node:sqlite";
import type {
  CampaignSummary,
  DecisionSummary,
  DashboardResponse,
  ReferenceSummary,
  RunSummary,
  RunWorkspace,
  TaskSummary,
  WorkerRunSummary,
  WorkerSummary
} from "../../shared/types.js";
import type { AppConfig } from "../config.js";
import { buildHealth } from "./health-service.js";
import { listArtifacts } from "./artifact-service.js";
import { listNotifications } from "./notification-service.js";
import { compactText, parseJsonArray } from "./serialization.js";

interface CampaignRow {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

interface RunRow {
  id: string;
  campaignId: string;
  campaignTitle: string;
  title: string;
  status: RunSummary["status"];
  instruction: string;
  pmSummary: string;
  maxParallelWorkers: number;
  maxAttemptsPerTask: number;
  maxTotalMinutes: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ReferenceRow {
  id: string;
  runId: string;
  title: string;
  kind: ReferenceSummary["kind"];
  source: string;
  contentPreview: string;
  createdAt: string;
}

interface WorkerRow {
  id: string;
  runId: string;
  name: string;
  role: string;
  mission: string;
  model: string | null;
  createdAt: string;
}

interface TaskRow {
  id: string;
  runId: string;
  workerId: string | null;
  workerName: string | null;
  title: string;
  instructions: string;
  acceptanceCriteria: string;
  status: TaskSummary["status"];
  priority: string;
  attempt: number;
  maxAttempts: number;
  dependsOn: string;
  artifactIds: string;
  updatedAt: string;
}

interface WorkerRunRow {
  id: string;
  runId: string;
  taskId: string;
  taskTitle: string;
  workerId: string | null;
  workerName: string | null;
  status: WorkerRunSummary["status"];
  model: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  errorSummary: string;
}

interface DecisionRow {
  id: string;
  runId: string;
  title: string;
  reason: string;
  options: string;
  recommendedOption: string;
  status: DecisionSummary["status"];
  answer: string | null;
  blocks: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeCampaign(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function normalizeRun(row: RunRow): RunSummary {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaignTitle,
    title: row.title,
    status: row.status,
    instruction: row.instruction,
    pmSummary: row.pmSummary,
    maxParallelWorkers: row.maxParallelWorkers,
    maxAttemptsPerTask: row.maxAttemptsPerTask,
    maxTotalMinutes: row.maxTotalMinutes,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt
  };
}

export function listCampaigns(db: DatabaseSync): CampaignSummary[] {
  const rows = db
    .prepare(
      `SELECT id, title, summary, created_at AS createdAt, updated_at AS updatedAt
       FROM campaigns
       ORDER BY updated_at DESC, rowid DESC`
    )
    .all() as unknown as CampaignRow[];
  return rows.map(normalizeCampaign);
}

export function listRuns(db: DatabaseSync): RunSummary[] {
  const rows = db
    .prepare(
      `SELECT
        r.id,
        r.campaign_id AS campaignId,
        c.title AS campaignTitle,
        r.title,
        r.status,
        r.instruction,
        r.pm_summary AS pmSummary,
        r.max_parallel_workers AS maxParallelWorkers,
        r.max_attempts_per_task AS maxAttemptsPerTask,
        r.max_total_minutes AS maxTotalMinutes,
        r.created_at AS createdAt,
        r.started_at AS startedAt,
        r.completed_at AS completedAt
       FROM runs r
       JOIN campaigns c ON c.id = r.campaign_id
       ORDER BY r.created_at DESC, r.rowid DESC`
    )
    .all() as unknown as RunRow[];
  return rows.map(normalizeRun);
}

export function getRun(db: DatabaseSync, runId: string): RunSummary | null {
  return listRuns(db).find((run) => run.id === runId) ?? null;
}

export function getCampaign(db: DatabaseSync, campaignId: string): CampaignSummary | null {
  return listCampaigns(db).find((campaign) => campaign.id === campaignId) ?? null;
}

function listReferences(db: DatabaseSync, runId: string): ReferenceSummary[] {
  const rows = db
    .prepare(
      `SELECT
        id,
        run_id AS runId,
        title,
        kind,
        source,
        content_preview AS contentPreview,
        created_at AS createdAt
       FROM references_store
       WHERE run_id = ?
       ORDER BY created_at ASC, rowid ASC`
    )
    .all(runId) as unknown as ReferenceRow[];
  return rows;
}

function listWorkers(db: DatabaseSync, runId: string): WorkerSummary[] {
  const rows = db
    .prepare(
      `SELECT id, run_id AS runId, name, role, mission, model, created_at AS createdAt
       FROM workers
       WHERE run_id = ?
       ORDER BY created_at ASC, rowid ASC`
    )
    .all(runId) as unknown as WorkerRow[];
  return rows;
}

function listTasks(db: DatabaseSync, runId: string): TaskSummary[] {
  const rows = db
    .prepare(
      `SELECT
        t.id,
        t.run_id AS runId,
        t.worker_id AS workerId,
        w.name AS workerName,
        t.title,
        t.instructions,
        t.acceptance_criteria AS acceptanceCriteria,
        t.status,
        t.priority,
        t.attempt,
        t.max_attempts AS maxAttempts,
        t.depends_on AS dependsOn,
        t.artifact_ids AS artifactIds,
        t.updated_at AS updatedAt
       FROM tasks t
       LEFT JOIN workers w ON w.id = t.worker_id
       WHERE t.run_id = ?
       ORDER BY
         CASE t.status
           WHEN 'running' THEN 0
           WHEN 'queued' THEN 1
           WHEN 'in_review' THEN 2
           WHEN 'needs_revision' THEN 3
           WHEN 'blocked' THEN 4
           WHEN 'failed' THEN 5
           ELSE 6
         END,
         t.created_at ASC,
         t.rowid ASC`
    )
    .all(runId) as unknown as TaskRow[];

  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    workerId: row.workerId,
    workerName: row.workerName,
    title: row.title,
    instructions: row.instructions,
    acceptanceCriteria: row.acceptanceCriteria,
    status: row.status,
    priority: row.priority,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    dependsOn: parseJsonArray(row.dependsOn),
    artifactIds: parseJsonArray(row.artifactIds),
    updatedAt: row.updatedAt
  }));
}

function listWorkerRuns(db: DatabaseSync, runId: string): WorkerRunSummary[] {
  const rows = db
    .prepare(
      `SELECT
        wr.id,
        wr.run_id AS runId,
        wr.task_id AS taskId,
        t.title AS taskTitle,
        wr.worker_id AS workerId,
        w.name AS workerName,
        wr.status,
        wr.model,
        wr.started_at AS startedAt,
        wr.finished_at AS finishedAt,
        wr.exit_code AS exitCode,
        wr.error_summary AS errorSummary
       FROM worker_runs wr
       JOIN tasks t ON t.id = wr.task_id
       LEFT JOIN workers w ON w.id = wr.worker_id
       WHERE wr.run_id = ?
       ORDER BY wr.created_at DESC, wr.rowid DESC`
    )
    .all(runId) as unknown as WorkerRunRow[];
  return rows;
}

export function listDecisions(db: DatabaseSync, runId?: string, status?: string): DecisionSummary[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (runId) {
    clauses.push("run_id = ?");
    params.push(runId);
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT
        id,
        run_id AS runId,
        title,
        reason,
        options,
        recommended_option AS recommendedOption,
        status,
        answer,
        blocks,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM decisions
       ${where}
       ORDER BY updated_at DESC, rowid DESC`
    )
    .all(...params) as unknown as DecisionRow[];

  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    title: row.title,
    reason: row.reason,
    options: parseJsonArray(row.options),
    recommendedOption: row.recommendedOption,
    status: row.status,
    answer: row.answer,
    blocks: parseJsonArray(row.blocks),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export function getRunWorkspace(db: DatabaseSync, runId: string): RunWorkspace {
  const run = getRun(db, runId);
  if (!run) {
    throw new Error("실행을 찾지 못했습니다.");
  }

  const campaign = getCampaign(db, run.campaignId);
  if (!campaign) {
    throw new Error("캠페인을 찾지 못했습니다.");
  }

  const tasks = listTasks(db, runId);
  const artifacts = listArtifacts(db, runId);
  const notifications = listNotifications(db, { includeSeen: true, limit: 10 }).notifications.filter((item) => item.runId === runId);

  return {
    campaign,
    run,
    references: listReferences(db, runId),
    workers: listWorkers(db, runId),
    tasks,
    artifacts,
    workerRuns: listWorkerRuns(db, runId),
    decisions: listDecisions(db, runId),
    notifications,
    progress: {
      totalTasks: tasks.length,
      approvedTasks: tasks.filter((task) => task.status === "approved").length,
      runningTasks: tasks.filter((task) => task.status === "running" || task.status === "in_review").length,
      blockedTasks: tasks.filter((task) => task.status === "blocked").length,
      failedTasks: tasks.filter((task) => task.status === "failed").length,
      totalArtifacts: artifacts.length,
      approvedArtifacts: artifacts.filter((artifact) => artifact.status === "approved").length
    }
  };
}

export function buildDashboard(db: DatabaseSync, config: AppConfig): DashboardResponse {
  const runs = listRuns(db);
  const activeRuns = runs.slice(0, 6).map((run) => getRunWorkspace(db, run.id));
  return {
    health: buildHealth(config),
    campaigns: listCampaigns(db),
    runs,
    activeRuns,
    recentNotifications: listNotifications(db, { includeSeen: true, limit: 12 }).notifications,
    openDecisions: listDecisions(db, undefined, "open").map((decision) => ({
      ...decision,
      reason: compactText(decision.reason, 220)
    }))
  };
}
