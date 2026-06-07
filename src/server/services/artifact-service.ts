import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "../config.js";
import type { ArtifactDetailResponse, ArtifactSummary, ArtifactVersionSummary } from "../../shared/types.js";
import { absoluteFromRun, readTextFile, relativeToRun, runRoot, safeFileName, writeTextFile } from "../storage/file-store.js";
import { createId } from "./ids.js";

interface ArtifactRow {
  id: string;
  runId: string;
  title: string;
  kind: "markdown" | "html" | "json" | "file_bundle";
  status: "requested" | "draft" | "in_review" | "needs_revision" | "approved";
  currentVersionId: string | null;
  reviewSummary: string;
  updatedAt: string;
}

interface VersionRow {
  id: string;
  artifactId: string;
  version: number;
  createdBy: string;
  sourceWorkerRunId: string | null;
  path: string;
  createdAt: string;
}

interface RunCampaignRow {
  runId: string;
  campaignId: string;
}

export function normalizeArtifact(row: ArtifactRow & { currentVersion?: number | null }): ArtifactSummary {
  return {
    id: row.id,
    runId: row.runId,
    title: row.title,
    kind: row.kind,
    status: row.status,
    currentVersionId: row.currentVersionId,
    currentVersion: row.currentVersion ?? null,
    reviewSummary: row.reviewSummary,
    updatedAt: row.updatedAt
  };
}

export function normalizeVersion(row: VersionRow): ArtifactVersionSummary {
  return {
    id: row.id,
    artifactId: row.artifactId,
    version: row.version,
    createdBy: row.createdBy,
    sourceWorkerRunId: row.sourceWorkerRunId,
    path: row.path,
    createdAt: row.createdAt
  };
}

export function listArtifacts(db: DatabaseSync, runId?: string): ArtifactSummary[] {
  const where = runId ? "WHERE a.run_id = ?" : "";
  const rows = db
    .prepare(
      `SELECT
        a.id,
        a.run_id AS runId,
        a.title,
        a.kind,
        a.status,
        a.current_version_id AS currentVersionId,
        a.review_summary AS reviewSummary,
        a.updated_at AS updatedAt,
        v.version AS currentVersion
       FROM artifacts a
       LEFT JOIN artifact_versions v ON v.id = a.current_version_id
       ${where}
       ORDER BY a.updated_at DESC, a.rowid DESC`
    )
    .all(...(runId ? [runId] : [])) as unknown as (ArtifactRow & { currentVersion?: number | null })[];

  return rows.map(normalizeArtifact);
}

export function createArtifactVersion(
  db: DatabaseSync,
  config: AppConfig,
  input: {
    artifactId: string;
    createdBy: string;
    sourceWorkerRunId?: string | null;
    content: string;
    status?: "draft" | "in_review" | "needs_revision" | "approved";
  }
): ArtifactVersionSummary {
  const artifact = db
    .prepare(
      `SELECT a.title, a.run_id AS runId, r.campaign_id AS campaignId
       FROM artifacts a
       JOIN runs r ON r.id = a.run_id
       WHERE a.id = ?`
    )
    .get(input.artifactId) as { title: string; runId: string; campaignId: string } | undefined;
  if (!artifact) {
    throw new Error("산출물을 찾지 못했습니다.");
  }

  const row = db
    .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS nextVersion FROM artifact_versions WHERE artifact_id = ?")
    .get(input.artifactId) as { nextVersion: number } | undefined;
  const version = row?.nextVersion ?? 1;
  const versionId = createId("artifact-version");
  const fileName = `${String(version).padStart(3, "0")}-${safeFileName(artifact.title, "artifact")}.md`;
  const absolutePath = path.join(runRoot(config, artifact.campaignId, artifact.runId), "artifacts", input.artifactId, fileName);
  writeTextFile(absolutePath, input.content);
  const relativePath = relativeToRun(config, artifact.campaignId, artifact.runId, absolutePath);

  db.prepare(
    `INSERT INTO artifact_versions (id, artifact_id, version, created_by, source_worker_run_id, path)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(versionId, input.artifactId, version, input.createdBy, input.sourceWorkerRunId ?? null, relativePath);
  db.prepare(
    `UPDATE artifacts
     SET current_version_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(versionId, input.status ?? "draft", input.artifactId);

  return {
    id: versionId,
    artifactId: input.artifactId,
    version,
    createdBy: input.createdBy,
    sourceWorkerRunId: input.sourceWorkerRunId ?? null,
    path: relativePath,
    createdAt: new Date().toISOString()
  };
}

export function getArtifactDetail(db: DatabaseSync, config: AppConfig, artifactId: string): ArtifactDetailResponse {
  const artifact = listArtifacts(db).find((item) => item.id === artifactId);
  if (!artifact) {
    throw new Error("산출물을 찾지 못했습니다.");
  }

  const runCampaign = db
    .prepare(
      `SELECT r.id AS runId, r.campaign_id AS campaignId
       FROM runs r
       JOIN artifacts a ON a.run_id = r.id
       WHERE a.id = ?`
    )
    .get(artifactId) as RunCampaignRow | undefined;
  if (!runCampaign) {
    throw new Error("산출물의 실행 정보를 찾지 못했습니다.");
  }

  const versionRow = artifact.currentVersionId
    ? (db
        .prepare(
          `SELECT
            id,
            artifact_id AS artifactId,
            version,
            created_by AS createdBy,
            source_worker_run_id AS sourceWorkerRunId,
            path,
            created_at AS createdAt
           FROM artifact_versions
           WHERE id = ?`
        )
        .get(artifact.currentVersionId) as VersionRow | undefined)
    : undefined;

  const currentVersion = versionRow ? normalizeVersion(versionRow) : null;
  const content = currentVersion ? readTextFile(absoluteFromRun(config, runCampaign.campaignId, runCampaign.runId, currentVersion.path)) : "";

  return { artifact, currentVersion, content };
}
