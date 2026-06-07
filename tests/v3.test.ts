import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/server/config.js";
import { createDatabaseContext } from "../src/server/storage/db.js";
import { delegateWork } from "../src/server/services/planner-service.js";
import { startRun } from "../src/server/services/run-engine.js";
import { getArtifactDetail, listArtifacts } from "../src/server/services/artifact-service.js";
import { listNotifications, markNotificationsSeen } from "../src/server/services/notification-service.js";

const tempDirs: string[] = [];
const openDbs: Array<{ close: () => void }> = [];

function testConfig(): AppConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-company-v3-"));
  tempDirs.push(dataDir);
  return {
    rootDir: process.cwd(),
    host: "127.0.0.1",
    port: 8789,
    dataDir,
    codexRunner: "mock",
    codexCliBin: "codex",
    codexPmModel: "gpt-5.5",
    codexWorkerModel: "gpt-5.5",
    codexReviewModel: "gpt-5.5",
    codexTimeoutMs: 600000,
    maxParallelWorkers: 2,
    maxAttemptsPerTask: 2,
    maxTotalMinutes: 120
  };
}

afterEach(() => {
  for (const db of openDbs.splice(0)) {
    db.close();
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Local Company V3", () => {
  it("delegates work, runs workers, stores artifacts, reviews, and creates notifications", async () => {
    const config = testConfig();
    const context = createDatabaseContext(config);
    openDbs.push(context.db);

    const delegated = await delegateWork(context.db, config, {
      title: "콘텐츠 트랙 제작",
      instruction: "가이드를 기준으로 산출물 3개를 만들어줘.",
      references: [
        {
          title: "제작 가이드",
          kind: "file",
          source: "guide.md",
          content: "트랙 개요, 핵심 내용, 실행안, 검토 기준을 포함한다."
        }
      ],
      constraints: {
        maxParallelWorkers: 2
      }
    });

    expect(delegated.planStatus).toBe("planned");
    expect(delegated.taskCount).toBe(3);
    expect(delegated.artifactCount).toBe(3);

    const started = await startRun(context.db, config, delegated.runId, {
      mode: "until_complete",
      maxParallelWorkers: 2
    });

    expect(started.status).toBe("completed");
    expect(started.workspace.progress.approvedTasks).toBe(3);
    expect(started.workspace.progress.approvedArtifacts).toBe(3);

    const artifacts = listArtifacts(context.db, delegated.runId);
    expect(artifacts).toHaveLength(3);
    expect(artifacts.every((artifact) => artifact.status === "approved")).toBe(true);

    const detail = getArtifactDetail(context.db, config, artifacts[0].id);
    expect(detail.content).toContain("## 목표");
    expect(detail.currentVersion?.version).toBe(1);

    const notifications = listNotifications(context.db, { includeSeen: true });
    expect(notifications.notifications.some((item) => item.type === "run_completed")).toBe(true);
    expect(notifications.notifications.some((item) => item.type === "artifact_approved")).toBe(true);

    const seen = markNotificationsSeen(context.db, notifications.latestSequence);
    expect(seen.unseenCount).toBe(0);
  });
});
