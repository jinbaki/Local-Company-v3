import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "../config.js";
import type { ArtifactDetailResponse, ArtifactKind, ArtifactSummary, ArtifactVersionSummary } from "../../shared/types.js";
import {
  absoluteFromRun,
  readBinaryFile,
  readTextFile,
  relativeToRun,
  runRoot,
  safeFileName,
  writeBinaryFile,
  writeTextFile
} from "../storage/file-store.js";
import { createId } from "./ids.js";

interface ArtifactRow {
  id: string;
  runId: string;
  title: string;
  kind: ArtifactKind;
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

function parseImageDataUrl(content: string): { mime: string; data: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(content.trim());
  if (!match) {
    return null;
  }
  return { mime: match[1].toLowerCase(), data: match[2].replace(/\s/g, "") };
}

function imageExtensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "jpg";
  }
  if (normalized === "image/svg+xml") {
    return "svg";
  }
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }
  return "img";
}

function mimeFromImagePath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  return "image/png";
}

function artifactExtension(kind: ArtifactKind, content: string): string {
  if (kind === "html") {
    return "html";
  }
  if (kind === "json") {
    return "json";
  }
  if (kind === "image") {
    const dataUrl = parseImageDataUrl(content);
    if (dataUrl) {
      return imageExtensionFromMime(dataUrl.mime);
    }
    if (content.trim().startsWith("<svg")) {
      return "svg";
    }
    return "image.txt";
  }
  return "md";
}

function writeArtifactContent(filePath: string, kind: ArtifactKind, content: string): void {
  const dataUrl = kind === "image" ? parseImageDataUrl(content) : null;
  if (dataUrl) {
    writeBinaryFile(filePath, Buffer.from(dataUrl.data, "base64"));
    return;
  }
  writeTextFile(filePath, content);
}

function readArtifactContent(filePath: string, kind: ArtifactKind): string {
  if (kind === "image") {
    const extension = path.extname(filePath).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(extension)) {
      const mime = mimeFromImagePath(filePath);
      if (extension === ".svg") {
        const svg = readTextFile(filePath);
        return `data:${mime};utf8,${encodeURIComponent(svg)}`;
      }
      return `data:${mime};base64,${readBinaryFile(filePath).toString("base64")}`;
    }
  }
  return readTextFile(filePath);
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
      `SELECT a.title, a.kind, a.run_id AS runId, r.campaign_id AS campaignId
       FROM artifacts a
       JOIN runs r ON r.id = a.run_id
       WHERE a.id = ?`
    )
    .get(input.artifactId) as { title: string; kind: ArtifactKind; runId: string; campaignId: string } | undefined;
  if (!artifact) {
    throw new Error("산출물을 찾지 못했습니다.");
  }

  const row = db
    .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS nextVersion FROM artifact_versions WHERE artifact_id = ?")
    .get(input.artifactId) as { nextVersion: number } | undefined;
  const version = row?.nextVersion ?? 1;
  const versionId = createId("artifact-version");
  const fileName = `${String(version).padStart(3, "0")}-${safeFileName(artifact.title, "artifact")}.${artifactExtension(artifact.kind, input.content)}`;
  const absolutePath = path.join(runRoot(config, artifact.campaignId, artifact.runId), "artifacts", input.artifactId, fileName);
  writeArtifactContent(absolutePath, artifact.kind, input.content);
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
  const content = currentVersion
    ? readArtifactContent(absoluteFromRun(config, runCampaign.campaignId, runCampaign.runId, currentVersion.path), artifact.kind)
    : "";

  return { artifact, currentVersion, content };
}
