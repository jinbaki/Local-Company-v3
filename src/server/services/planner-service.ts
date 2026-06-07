import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "../config.js";
import type {
  DelegateWorkRequest,
  DelegateWorkResponse,
  PmPlan,
  PmPlanArtifact,
  PmPlanTask,
  PmPlanWorker,
  ReferenceKind
} from "../../shared/types.js";
import { ensureRunFolders, runRoot, safeFileName, writeTextFile } from "../storage/file-store.js";
import { extractJsonObject, generatePlannerOutput } from "./agent-runner.js";
import { createId } from "./ids.js";
import { createNotification } from "./notification-service.js";
import { compactText } from "./serialization.js";
import { getRunWorkspace } from "./workspace-service.js";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeKind(kind: string | undefined): "markdown" | "html" | "json" | "file_bundle" {
  return kind === "html" || kind === "json" || kind === "file_bundle" ? kind : "markdown";
}

function normalizeReferenceKind(kind: ReferenceKind | undefined): ReferenceKind {
  return kind === "url" || kind === "file" ? kind : "note";
}

function containsAbsolutePath(value: string): boolean {
  return /[A-Za-z]:\\|\/Users\/|\/home\/|\\\\/.test(value);
}

function validatePlan(plan: PmPlan): ValidationResult {
  const errors: string[] = [];

  if (!hasText(plan.summary)) {
    errors.push("PM plan summary가 필요합니다.");
  }

  if (!Array.isArray(plan.workers) || plan.workers.length < 1 || plan.workers.length > 8) {
    errors.push("worker는 1명 이상 8명 이하가 필요합니다.");
  }

  if (!Array.isArray(plan.artifacts) || plan.artifacts.length < 1) {
    errors.push("artifact는 1개 이상 필요합니다.");
  }

  if (!Array.isArray(plan.tasks) || plan.tasks.length < 1) {
    errors.push("task는 1개 이상 필요합니다.");
  }

  const workerIds = new Set((plan.workers ?? []).map((worker) => worker.clientId));
  const artifactIds = new Set((plan.artifacts ?? []).map((artifact) => artifact.clientId));
  const taskIds = new Set((plan.tasks ?? []).map((task) => task.clientId));

  for (const worker of plan.workers ?? []) {
    if (!hasText(worker.clientId) || !hasText(worker.name) || !hasText(worker.role) || !hasText(worker.mission)) {
      errors.push("각 worker에는 clientId, name, role, mission이 필요합니다.");
    }
  }

  for (const artifact of plan.artifacts ?? []) {
    if (!hasText(artifact.clientId) || !hasText(artifact.title)) {
      errors.push("각 artifact에는 clientId와 title이 필요합니다.");
    }
    if (hasText(artifact.title) && containsAbsolutePath(artifact.title)) {
      errors.push(`artifact title에 로컬 절대 경로가 포함되어 있습니다: ${artifact.title}`);
    }
  }

  for (const task of plan.tasks ?? []) {
    if (!hasText(task.clientId) || !hasText(task.title) || !hasText(task.instructions)) {
      errors.push("각 task에는 clientId, title, instructions가 필요합니다.");
    }
    if (task.workerRef && !workerIds.has(task.workerRef)) {
      errors.push(`존재하지 않는 workerRef입니다: ${task.workerRef}`);
    }
    for (const artifactRef of task.artifactRefs ?? []) {
      if (!artifactIds.has(artifactRef)) {
        errors.push(`존재하지 않는 artifactRef입니다: ${artifactRef}`);
      }
    }
    for (const dependency of task.dependsOn ?? []) {
      if (!taskIds.has(dependency)) {
        errors.push(`존재하지 않는 dependsOn task입니다: ${dependency}`);
      }
    }
  }

  for (const decision of plan.decisions ?? []) {
    if (!hasText(decision.clientId) || !hasText(decision.title) || !hasText(decision.reason) || decision.options.length < 2) {
      errors.push("decision에는 clientId, title, reason, options 2개 이상이 필요합니다.");
    }
    for (const block of decision.blocks ?? []) {
      if (!taskIds.has(block)) {
        errors.push(`decision blocks에 존재하지 않는 task가 있습니다: ${block}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function insertCampaign(db: DatabaseSync, title: string, summary: string): string {
  const campaignId = createId("campaign");
  db.prepare("INSERT INTO campaigns (id, title, summary) VALUES (?, ?, ?)").run(campaignId, title, summary);
  return campaignId;
}

function insertRun(db: DatabaseSync, campaignId: string, input: DelegateWorkRequest, planSummary = ""): string {
  const runId = createId("run");
  db.prepare(
    `INSERT INTO runs (
      id,
      campaign_id,
      title,
      status,
      instruction,
      pm_summary,
      max_parallel_workers,
      max_attempts_per_task,
      max_total_minutes
    )
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
  ).run(
    runId,
    campaignId,
    input.title,
    input.instruction,
    planSummary,
    input.constraints?.maxParallelWorkers ?? 3,
    input.constraints?.maxAttemptsPerTask ?? 2,
    input.constraints?.maxTotalMinutes ?? 120
  );
  return runId;
}

function renderReferencesForPrompt(db: DatabaseSync, runId: string): string {
  const rows = db
    .prepare("SELECT title, kind, source, content_preview AS contentPreview FROM references_store WHERE run_id = ? ORDER BY rowid ASC")
    .all(runId) as { title: string; kind: string; source: string; contentPreview: string }[];
  return rows.map((row) => `- ${row.title} (${row.kind}, ${row.source || "source 없음"}): ${row.contentPreview}`).join("\n");
}

function saveReferences(db: DatabaseSync, config: AppConfig, campaignId: string, runId: string, references: DelegateWorkRequest["references"]): void {
  for (const reference of references ?? []) {
    const referenceId = createId("reference");
    const kind = normalizeReferenceKind(reference.kind);
    const content = reference.content ?? "";
    const fileName = `${referenceId}-${safeFileName(reference.title, "reference")}.md`;
    const filePath = path.join(runRoot(config, campaignId, runId), "references", fileName);
    writeTextFile(filePath, content);
    db.prepare(
      `INSERT INTO references_store (id, run_id, title, kind, source, content_path, content_preview)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(referenceId, runId, reference.title, kind, reference.source ?? "", `references/${fileName}`, compactText(content, 500));
  }
}

function applyPlan(db: DatabaseSync, runId: string, plan: PmPlan, rawJson: string, errors: string[]): void {
  const planId = createId("pm-plan");
  const validationStatus = errors.length === 0 ? "valid" : "invalid";
  db.prepare(
    `INSERT INTO pm_plans (id, run_id, raw_json, validated_json, status, validation_errors)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(planId, runId, rawJson, JSON.stringify(plan, null, 2), validationStatus, JSON.stringify(errors));

  if (errors.length > 0) {
    db.prepare("UPDATE runs SET status = 'blocked', pm_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      plan.summary ?? "PM 계획 검증에 실패했습니다.",
      runId
    );
    return;
  }

  const workerMap = new Map<string, string>();
  for (const worker of plan.workers as PmPlanWorker[]) {
    const workerId = createId("worker");
    workerMap.set(worker.clientId, workerId);
    db.prepare(
      `INSERT INTO workers (id, run_id, client_id, name, role, mission, model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(workerId, runId, worker.clientId, worker.name, worker.role, worker.mission, worker.model ?? null);
  }

  const artifactMap = new Map<string, string>();
  for (const artifact of plan.artifacts as PmPlanArtifact[]) {
    const artifactId = createId("artifact");
    artifactMap.set(artifact.clientId, artifactId);
    db.prepare(
      `INSERT INTO artifacts (id, run_id, client_id, title, kind, status)
       VALUES (?, ?, ?, ?, ?, 'requested')`
    ).run(artifactId, runId, artifact.clientId, artifact.title, normalizeKind(artifact.kind));
  }

  const taskMap = new Map<string, string>();
  for (const task of plan.tasks as PmPlanTask[]) {
    const taskId = createId("task");
    taskMap.set(task.clientId, taskId);
    const artifactIds = task.artifactRefs.map((ref) => artifactMap.get(ref)).filter((id): id is string => Boolean(id));
    db.prepare(
      `INSERT INTO tasks (
        id,
        run_id,
        client_id,
        worker_id,
        title,
        instructions,
        acceptance_criteria,
        status,
        priority,
        max_attempts,
        depends_on,
        artifact_ids
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`
    ).run(
      taskId,
      runId,
      task.clientId,
      task.workerRef ? workerMap.get(task.workerRef) ?? null : null,
      task.title,
      task.instructions,
      task.acceptanceCriteria ?? "",
      task.priority ?? "normal",
      plan.runPolicy?.maxAttemptsPerTask ?? 2,
      JSON.stringify(task.dependsOn?.map((ref) => taskMap.get(ref) ?? ref) ?? []),
      JSON.stringify(artifactIds)
    );
  }

  for (const decision of plan.decisions ?? []) {
    db.prepare(
      `INSERT INTO decisions (id, run_id, client_id, title, reason, options, recommended_option, status, blocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      createId("decision"),
      runId,
      decision.clientId,
      decision.title,
      decision.reason,
      JSON.stringify(decision.options),
      decision.recommendedOption,
      JSON.stringify(decision.blocks?.map((ref) => taskMap.get(ref) ?? ref) ?? [])
    );
  }

  const hasOpenDecision = (plan.decisions ?? []).length > 0;
  db.prepare(
    `UPDATE runs
     SET status = ?, pm_summary = ?, max_parallel_workers = COALESCE(?, max_parallel_workers)
     WHERE id = ?`
  ).run(hasOpenDecision ? "blocked" : "planned", plan.summary, plan.runPolicy?.maxParallelWorkers ?? null, runId);
}

export async function delegateWork(db: DatabaseSync, config: AppConfig, input: DelegateWorkRequest): Promise<DelegateWorkResponse> {
  if (!hasText(input.title) || !hasText(input.instruction)) {
    throw new Error("작업 제목과 지시가 필요합니다.");
  }

  const campaignId = insertCampaign(db, input.title, compactText(input.instruction, 240));
  const runId = insertRun(db, campaignId, input);
  ensureRunFolders(config, campaignId, runId);
  saveReferences(db, config, campaignId, runId, input.references);

  const rawOutput = await generatePlannerOutput(config, {
    title: input.title,
    instruction: input.instruction,
    references: renderReferencesForPrompt(db, runId)
  });
  const parsed = extractJsonObject(rawOutput) as PmPlan;
  const validation = validatePlan(parsed);
  applyPlan(db, runId, parsed, rawOutput, validation.errors);

  if (validation.errors.length > 0) {
    createNotification({
      db,
      type: "run_blocked",
      runId,
      title: "PM 계획 검증 실패",
      summary: validation.errors.slice(0, 3).join(" / ")
    });
  } else {
    createNotification({
      db,
      type: "run_planned",
      runId,
      title: "PM 계획 생성",
      summary: parsed.summary
    });
  }

  const workspace = getRunWorkspace(db, runId);
  return {
    campaignId,
    runId,
    planStatus: validation.errors.length > 0 || workspace.decisions.some((decision) => decision.status === "open") ? "blocked" : "planned",
    pmSummary: workspace.run.pmSummary,
    taskCount: workspace.tasks.length,
    artifactCount: workspace.artifacts.length,
    workerCount: workspace.workers.length,
    requiresDecision: workspace.decisions.some((decision) => decision.status === "open"),
    workspace
  };
}
