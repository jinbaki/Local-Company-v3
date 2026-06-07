import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config.js";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function campaignRoot(config: AppConfig, campaignId: string): string {
  return path.join(config.dataDir, "campaigns", campaignId);
}

export function runRoot(config: AppConfig, campaignId: string, runId: string): string {
  return path.join(campaignRoot(config, campaignId), "runs", runId);
}

export function ensureRunFolders(config: AppConfig, campaignId: string, runId: string): void {
  for (const folder of ["references", "plan", "prompts", "worker-runs", "artifacts", "briefs"]) {
    ensureDir(path.join(runRoot(config, campaignId, runId), folder));
  }
}

export function safeFileName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function relativeToRun(config: AppConfig, campaignId: string, runId: string, filePath: string): string {
  return path.relative(runRoot(config, campaignId, runId), filePath).split(path.sep).join("/");
}

export function absoluteFromRun(config: AppConfig, campaignId: string, runId: string, relativePath: string): string {
  return path.join(runRoot(config, campaignId, runId), relativePath);
}
