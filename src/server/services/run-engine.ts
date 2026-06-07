import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "../config.js";
import type { StartRunRequest, StartRunResponse, TaskSummary } from "../../shared/types.js";
import { createArtifactVersion, getArtifactDetail } from "./artifact-service.js";
import { generateReviewOutput, generateWorkerOutput } from "./agent-runner.js";
import { createId } from "./ids.js";
import { createNotification } from "./notification-service.js";
import { parseJsonArray } from "./serialization.js";
import { absoluteFromRun, relativeToRun, runRoot, writeTextFile } from "../storage/file-store.js";
import { getRun, getRunWorkspace, listDecisions } from "./workspace-service.js";

interface TaskRunRow {
  id: string;
  runId: string;
  campaignId: string;
  workerId: string | null;
  workerName: string | null;
  title: string;
  instructions: string;
  acceptanceCriteria: string;
  status: TaskSummary["status"];
  attempt: number;
  maxAttempts: number;
  dependsOn: string;
  artifactIds: string;
}

interface ArtifactReviewRow {
  id: string;
  title: string;
  status: string;
}

function getTaskRows(db: DatabaseSync, runId: string): TaskRunRow[] {
  return db
    .prepare(
      `SELECT
        t.id,
        t.run_id AS runId,
        r.campaign_id AS campaignId,
        t.worker_id AS workerId,
        w.name AS workerName,
        t.title,
        t.instructions,
        t.acceptance_criteria AS acceptanceCriteria,
        t.status,
        t.attempt,
        t.max_attempts AS maxAttempts,
        t.depends_on AS dependsOn,
        t.artifact_ids AS artifactIds
       FROM tasks t
       JOIN runs r ON r.id = t.run_id
       LEFT JOIN workers w ON w.id = t.worker_id
       WHERE t.run_id = ?
       ORDER BY
         CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         t.created_at ASC,
         t.rowid ASC`
    )
    .all(runId) as unknown as TaskRunRow[];
}

function dependenciesApproved(tasks: TaskRunRow[], task: TaskRunRow): boolean {
  const dependencyIds = parseJsonArray(task.dependsOn);
  return dependencyIds.every((id) => tasks.find((candidate) => candidate.id === id)?.status === "approved");
}

function referencesForRun(db: DatabaseSync, runId: string): string {
  const rows = db
    .prepare("SELECT title, kind, source, content_preview AS contentPreview FROM references_store WHERE run_id = ? ORDER BY rowid ASC")
    .all(runId) as { title: string; kind: string; source: string; contentPreview: string }[];
  return rows.map((row) => `- ${row.title} (${row.kind}, ${row.source || "source 없음"}): ${row.contentPreview}`).join("\n");
}

function createWorkerRun(db: DatabaseSync, task: TaskRunRow, model: string, promptPath: string): string {
  const workerRunId = createId("worker-run");
  db.prepare(
    `INSERT INTO worker_runs (id, run_id, task_id, worker_id, status, model, prompt_path, started_at)
     VALUES (?, ?, ?, ?, 'running', ?, ?, CURRENT_TIMESTAMP)`
  ).run(workerRunId, task.runId, task.id, task.workerId, model, promptPath);
  return workerRunId;
}

function markWorkerRunDone(db: DatabaseSync, workerRunId: string, outputPath: string): void {
  db.prepare(
    `UPDATE worker_runs
     SET status = 'completed', output_path = ?, finished_at = CURRENT_TIMESTAMP, exit_code = 0
     WHERE id = ?`
  ).run(outputPath, workerRunId);
}

function markWorkerRunFailed(db: DatabaseSync, workerRunId: string, errorPath: string, message: string): void {
  db.prepare(
    `UPDATE worker_runs
     SET status = 'failed', error_path = ?, error_summary = ?, finished_at = CURRENT_TIMESTAMP, exit_code = 1
     WHERE id = ?`
  ).run(errorPath, message, workerRunId);
}

async function runWorkerTask(db: DatabaseSync, config: AppConfig, task: TaskRunRow): Promise<void> {
  const model = config.codexWorkerModel;
  const prompt = [
    `Task: ${task.title}`,
    "",
    "Instructions:",
    task.instructions,
    "",
    "Acceptance criteria:",
    task.acceptanceCriteria || "PM이 검토할 수 있는 산출물이어야 합니다."
  ].join("\n");
  const promptPathAbs = path.join(runRoot(config, task.campaignId, task.runId), "prompts", `${task.id}.md`);
  writeTextFile(promptPathAbs, prompt);
  const promptPath = relativeToRun(config, task.campaignId, task.runId, promptPathAbs);
  const workerRunId = createWorkerRun(db, task, model, promptPath);

  db.prepare(
    `UPDATE tasks
     SET status = 'running', attempt = attempt + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(task.id);

  try {
    const content = await generateWorkerOutput(config, {
      workerName: task.workerName ?? "AI worker",
      taskTitle: task.title,
      instructions: task.instructions,
      acceptanceCriteria: task.acceptanceCriteria,
      references: referencesForRun(db, task.runId)
    });
    const outputAbs = path.join(runRoot(config, task.campaignId, task.runId), "worker-runs", workerRunId, "result.md");
    writeTextFile(outputAbs, content);
    const outputPath = relativeToRun(config, task.campaignId, task.runId, outputAbs);

    for (const artifactId of parseJsonArray(task.artifactIds)) {
      createArtifactVersion(db, config, {
        artifactId,
        createdBy: task.workerName ?? "AI worker",
        sourceWorkerRunId: workerRunId,
        content,
        status: "in_review"
      });
      createNotification({
        db,
        type: "artifact_ready",
        runId: task.runId,
        artifactId,
        title: "산출물 초안 생성",
        summary: `${task.title} 결과가 PM 리뷰 대기 상태가 되었습니다.`
      });
    }

    markWorkerRunDone(db, workerRunId, outputPath);
    db.prepare("UPDATE tasks SET status = 'in_review', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "worker 실행 중 오류가 발생했습니다.";
    const errorAbs = path.join(runRoot(config, task.campaignId, task.runId), "worker-runs", workerRunId, "error.txt");
    writeTextFile(errorAbs, message);
    markWorkerRunFailed(db, workerRunId, relativeToRun(config, task.campaignId, task.runId, errorAbs), message);

    const nextStatus = task.attempt + 1 >= task.maxAttempts ? "failed" : "queued";
    db.prepare("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextStatus, task.id);
    createNotification({
      db,
      type: "worker_failed",
      runId: task.runId,
      title: "worker 실행 실패",
      summary: message
    });
  }
}

function getArtifactRowsForTask(db: DatabaseSync, task: TaskRunRow): ArtifactReviewRow[] {
  const artifactIds = parseJsonArray(task.artifactIds);
  if (artifactIds.length === 0) {
    return [];
  }
  const placeholders = artifactIds.map(() => "?").join(", ");
  return db
    .prepare(`SELECT id, title, status FROM artifacts WHERE id IN (${placeholders}) ORDER BY rowid ASC`)
    .all(...artifactIds) as unknown as ArtifactReviewRow[];
}

async function reviewTask(db: DatabaseSync, config: AppConfig, task: TaskRunRow): Promise<void> {
  const artifacts = getArtifactRowsForTask(db, task);
  let needsRevision = false;
  let blocked = false;

  for (const artifact of artifacts) {
    const detail = getArtifactDetail(db, config, artifact.id);
    const review = await generateReviewOutput(config, {
      artifactTitle: artifact.title,
      content: detail.content,
      acceptanceCriteria: task.acceptanceCriteria
    });
    const reviewId = createId("review");
    db.prepare(
      `INSERT INTO reviews (id, run_id, artifact_id, result, summary, body)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(reviewId, task.runId, artifact.id, review.result, review.summary, review.review);

    if (review.result === "approved") {
      db.prepare(
        `UPDATE artifacts
         SET status = 'approved', review_summary = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(review.summary, artifact.id);
      createNotification({
        db,
        type: "artifact_approved",
        runId: task.runId,
        artifactId: artifact.id,
        title: "산출물 승인 완료",
        summary: `${artifact.title}: ${review.summary}`
      });
      continue;
    }

    if (review.result === "needs_revision") {
      needsRevision = true;
      db.prepare(
        `UPDATE artifacts
         SET status = 'needs_revision', review_summary = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(review.summary, artifact.id);
      continue;
    }

    blocked = true;
    db.prepare(
      `UPDATE artifacts
       SET status = 'needs_revision', review_summary = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(review.summary, artifact.id);
    const decisionId = createId("decision");
    db.prepare(
      `INSERT INTO decisions (id, run_id, title, reason, options, recommended_option, status, blocks)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      decisionId,
      task.runId,
      `${artifact.title} 대표 확인 필요`,
      review.summary,
      JSON.stringify(["대표가 기준을 제공한다", "PM이 안전한 범위에서 보류한다"]),
      "대표가 기준을 제공한다",
      JSON.stringify([task.id])
    );
    createNotification({
      db,
      type: "decision_requested",
      runId: task.runId,
      artifactId: artifact.id,
      title: "대표 확인 필요",
      summary: review.summary
    });
  }

  if (blocked) {
    db.prepare("UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
    db.prepare("UPDATE runs SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.runId);
    return;
  }

  if (needsRevision) {
    const nextStatus = task.attempt >= task.maxAttempts ? "blocked" : "queued";
    db.prepare("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextStatus, task.id);
    if (nextStatus === "blocked") {
      const decisionId = createId("decision");
      db.prepare(
        `INSERT INTO decisions (id, run_id, title, reason, options, recommended_option, status, blocks)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
      ).run(
        decisionId,
        task.runId,
        `${task.title} 재작업 한도 도달`,
        "동일 작업이 최대 재작업 횟수에 도달했습니다.",
        JSON.stringify(["대표가 새 기준을 제공한다", "현재 산출물을 보류한다"]),
        "대표가 새 기준을 제공한다",
        JSON.stringify([task.id])
      );
      db.prepare("UPDATE runs SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.runId);
      createNotification({
        db,
        type: "run_blocked",
        runId: task.runId,
        title: "재작업 한도 도달",
        summary: `${task.title} 작업에 대표 확인이 필요합니다.`
      });
    }
    return;
  }

  db.prepare("UPDATE tasks SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
}

function updateRunCompletionIfDone(db: DatabaseSync, runId: string): boolean {
  const tasks = getTaskRows(db, runId);
  const openDecisions = listDecisions(db, runId, "open");
  if (tasks.length > 0 && tasks.every((task) => task.status === "approved") && openDecisions.length === 0) {
    db.prepare("UPDATE runs SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
    return true;
  }

  return false;
}

function hasFailedTasks(db: DatabaseSync, runId: string): boolean {
  return getTaskRows(db, runId).some((task) => task.status === "failed");
}

function shouldContinue(mode: string | undefined, iteration: number): boolean {
  if (mode === "plan_only") {
    return false;
  }
  return iteration < 100;
}

export async function startRun(
  db: DatabaseSync,
  config: AppConfig,
  runId: string,
  request: StartRunRequest = {}
): Promise<StartRunResponse> {
  const run = getRun(db, runId);
  if (!run) {
    throw new Error("실행을 찾지 못했습니다.");
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "stopped") {
    return {
      runId,
      status: run.status,
      message: `이미 ${run.status} 상태입니다.`,
      workspace: getRunWorkspace(db, runId)
    };
  }

  if (listDecisions(db, runId, "open").length > 0) {
    db.prepare("UPDATE runs SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
    return {
      runId,
      status: "blocked",
      message: "대표 확인 항목이 있어 실행을 시작하지 않았습니다.",
      workspace: getRunWorkspace(db, runId)
    };
  }

  db.prepare(
    `UPDATE runs
     SET status = 'running',
         started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
         max_parallel_workers = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(request.maxParallelWorkers ?? run.maxParallelWorkers ?? config.maxParallelWorkers, runId);

  const maxParallel = Math.max(1, Math.min(request.maxParallelWorkers ?? run.maxParallelWorkers ?? config.maxParallelWorkers, 8));
  let iteration = 0;
  let madeProgress = true;

  while (madeProgress && shouldContinue(request.mode ?? "until_next_decision", iteration)) {
    iteration += 1;
    madeProgress = false;

    const reviewTargets = getTaskRows(db, runId).filter((task) => task.status === "in_review");
    for (const task of reviewTargets) {
      await reviewTask(db, config, task);
      madeProgress = true;
      if (listDecisions(db, runId, "open").length > 0) {
        db.prepare("UPDATE runs SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
        return {
          runId,
          status: "blocked",
          message: "대표 확인 항목이 생겨 실행을 멈췄습니다.",
          workspace: getRunWorkspace(db, runId)
        };
      }
    }

    if (updateRunCompletionIfDone(db, runId)) {
      createNotification({
        db,
        type: "run_completed",
        runId,
        title: "실행 완료",
        summary: `${run.title} 실행이 완료되었습니다.`
      });
      return {
        runId,
        status: "completed",
        message: "모든 작업과 PM 리뷰가 완료되었습니다.",
        workspace: getRunWorkspace(db, runId)
      };
    }

    if (hasFailedTasks(db, runId)) {
      db.prepare("UPDATE runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
      createNotification({
        db,
        type: "run_failed",
        runId,
        title: "실행 실패",
        summary: `${run.title} 실행 중 실패한 작업이 있습니다.`
      });
      return {
        runId,
        status: "failed",
        message: "실패한 작업이 있어 실행을 중단했습니다.",
        workspace: getRunWorkspace(db, runId)
      };
    }

    const tasks = getTaskRows(db, runId);
    const runnable = tasks.filter((task) => task.status === "queued" && dependenciesApproved(tasks, task)).slice(0, maxParallel);
    if (runnable.length > 0) {
      await Promise.all(runnable.map((task) => runWorkerTask(db, config, task)));
      madeProgress = true;
    }
  }

  const latest = getRun(db, runId);
  return {
    runId,
    status: latest?.status ?? "running",
    message: madeProgress ? "실행 루프가 멈췄습니다." : "현재 더 실행할 수 있는 작업이 없습니다.",
    workspace: getRunWorkspace(db, runId)
  };
}

export function stopRun(db: DatabaseSync, runId: string): StartRunResponse {
  const run = getRun(db, runId);
  if (!run) {
    throw new Error("실행을 찾지 못했습니다.");
  }
  db.prepare("UPDATE runs SET status = 'stopped', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
  createNotification({
    db,
    type: "run_stopped",
    runId,
    title: "실행 중지",
    summary: `${run.title} 실행이 중지되었습니다.`
  });
  return {
    runId,
    status: "stopped",
    message: "실행을 중지했습니다.",
    workspace: getRunWorkspace(db, runId)
  };
}

export function answerDecision(
  db: DatabaseSync,
  runId: string,
  decisionId: string,
  input: { selectedOption: string; answer?: string }
): StartRunResponse {
  const decision = listDecisions(db, runId).find((item) => item.id === decisionId);
  if (!decision) {
    throw new Error("대표 확인 항목을 찾지 못했습니다.");
  }

  db.prepare(
    `UPDATE decisions
     SET status = 'answered', answer = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run([input.selectedOption, input.answer].filter(Boolean).join("\n"), decisionId);

  for (const taskId of decision.blocks) {
    db.prepare("UPDATE tasks SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'blocked'").run(taskId);
  }

  if (listDecisions(db, runId, "open").length === 0) {
    db.prepare("UPDATE runs SET status = 'planned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'blocked'").run(runId);
  }

  createNotification({
    db,
    type: "decision_answered",
    runId,
    title: "대표 확인 답변 저장",
    summary: decision.title
  });

  const run = getRun(db, runId);
  return {
    runId,
    status: run?.status ?? "planned",
    message: "대표 확인 답변을 저장했습니다.",
    workspace: getRunWorkspace(db, runId)
  };
}
