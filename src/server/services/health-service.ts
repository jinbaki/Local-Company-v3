import type { HealthResponse } from "../../shared/types.js";
import type { AppConfig } from "../config.js";

export function buildHealth(config: AppConfig): HealthResponse {
  return {
    status: "ok",
    app: "Local Company V3",
    generatedAt: new Date().toISOString(),
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    runner: {
      mode: config.codexRunner,
      cliBin: config.codexCliBin,
      pmModel: config.codexPmModel,
      workerModel: config.codexWorkerModel,
      reviewModel: config.codexReviewModel,
      maxParallelWorkers: config.maxParallelWorkers
    }
  };
}
