import { Router } from "express";
import type { DatabaseContext } from "./storage/db.js";
import type { AnswerDecisionRequest, DelegateWorkRequest, StartRunRequest } from "../shared/types.js";
import { buildHealth } from "./services/health-service.js";
import { buildDashboard, getRunWorkspace } from "./services/workspace-service.js";
import { delegateWork } from "./services/planner-service.js";
import { answerDecision, startRun, stopRun } from "./services/run-engine.js";
import { listNotifications, markNotificationsSeen } from "./services/notification-service.js";
import { getArtifactDetail, listArtifacts } from "./services/artifact-service.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function readPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === "true" || value === "1";
}

export function createApiRouter(context: DatabaseContext): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json(buildHealth(context.config));
  });

  router.get("/dashboard", (_request, response) => {
    response.json(buildDashboard(context.db, context.config));
  });

  router.post("/delegations", async (request, response) => {
    try {
      const payload = await delegateWork(context.db, context.config, request.body as DelegateWorkRequest);
      response.status(201).json(payload);
    } catch (error: unknown) {
      response.status(400).json({ message: getErrorMessage(error) });
    }
  });

  router.get("/runs/:runId", (request, response) => {
    try {
      response.json(getRunWorkspace(context.db, request.params.runId));
    } catch (error: unknown) {
      response.status(404).json({ message: getErrorMessage(error) });
    }
  });

  router.post("/runs/:runId/start", async (request, response) => {
    try {
      const payload = await startRun(context.db, context.config, request.params.runId, request.body as StartRunRequest);
      response.status(201).json(payload);
    } catch (error: unknown) {
      response.status(400).json({ message: getErrorMessage(error) });
    }
  });

  router.post("/runs/:runId/stop", (request, response) => {
    try {
      response.status(201).json(stopRun(context.db, request.params.runId));
    } catch (error: unknown) {
      response.status(400).json({ message: getErrorMessage(error) });
    }
  });

  router.get("/notifications", (request, response) => {
    response.json(
      listNotifications(context.db, {
        afterSequence: readPositiveNumber(request.query.afterSequence),
        limit: readPositiveNumber(request.query.limit),
        includeSeen: readBoolean(request.query.includeSeen)
      })
    );
  });

  router.post("/notifications/seen", (request, response) => {
    response.json(markNotificationsSeen(context.db, typeof request.body?.sequence === "number" ? request.body.sequence : undefined));
  });

  router.get("/artifacts", (request, response) => {
    response.json({
      artifacts: listArtifacts(context.db, typeof request.query.runId === "string" ? request.query.runId : undefined)
    });
  });

  router.get("/artifacts/:artifactId", (request, response) => {
    try {
      response.json(getArtifactDetail(context.db, context.config, request.params.artifactId));
    } catch (error: unknown) {
      response.status(404).json({ message: getErrorMessage(error) });
    }
  });

  router.post("/runs/:runId/decisions/:decisionId/answer", (request, response) => {
    try {
      response.status(201).json(answerDecision(context.db, request.params.runId, request.params.decisionId, request.body as AnswerDecisionRequest));
    } catch (error: unknown) {
      response.status(400).json({ message: getErrorMessage(error) });
    }
  });

  return router;
}
