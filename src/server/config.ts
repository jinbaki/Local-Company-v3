import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  rootDir: string;
  host: string;
  port: number;
  dataDir: string;
  codexRunner: string;
  codexCliBin: string;
  codexPmModel: string;
  codexWorkerModel: string;
  codexReviewModel: string;
  codexTimeoutMs: number;
  maxParallelWorkers: number;
  maxAttemptsPerTask: number;
  maxTotalMinutes: number;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  const rootDir = process.cwd();
  const dataDir = path.resolve(rootDir, process.env.LOCAL_COMPANY_DATA_DIR ?? "data");

  fs.mkdirSync(dataDir, { recursive: true });

  return {
    rootDir,
    host: process.env.LOCAL_COMPANY_HOST ?? "127.0.0.1",
    port: numberEnv("LOCAL_COMPANY_PORT", 8789),
    dataDir,
    codexRunner: process.env.CODEX_RUNNER ?? "codex-cli",
    codexCliBin: process.env.CODEX_CLI_BIN ?? "codex",
    codexPmModel: process.env.CODEX_PM_MODEL ?? "gpt-5.5",
    codexWorkerModel: process.env.CODEX_WORKER_MODEL ?? "gpt-5.5",
    codexReviewModel: process.env.CODEX_REVIEW_MODEL ?? "gpt-5.5",
    codexTimeoutMs: numberEnv("CODEX_TIMEOUT_MS", 600000),
    maxParallelWorkers: numberEnv("RUN_MAX_PARALLEL_WORKERS", 3),
    maxAttemptsPerTask: numberEnv("RUN_MAX_ATTEMPTS_PER_TASK", 2),
    maxTotalMinutes: numberEnv("RUN_MAX_TOTAL_MINUTES", 120)
  };
}

export function isCodexCliRunner(config: AppConfig): boolean {
  return config.codexRunner.toLowerCase() === "codex-cli";
}
