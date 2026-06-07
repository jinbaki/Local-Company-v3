import readline from "node:readline";
import type {
  ArtifactDetailResponse,
  DashboardResponse,
  DelegateWorkRequest,
  DelegateWorkResponse,
  ListNotificationsResponse,
  MarkNotificationsSeenResponse,
  RunWorkspace,
  StartRunRequest,
  StartRunResponse
} from "../shared/types.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const baseUrl = process.env.LOCAL_COMPANY_BASE_URL ?? "http://127.0.0.1:8789";

const tools: ToolDefinition[] = [
  {
    name: "local_company_status",
    description: "Check Local Company V3 health, active runs, open decisions, and recent notifications.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "local_company_delegate_work",
    description: "Delegate a user request and optional references to the Local Company PM. This creates a run and PM plan.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short work title." },
        instruction: { type: "string", description: "Full user instruction to delegate to the PM." },
        references: {
          type: "array",
          description: "Optional reference materials. For files, pass extracted content.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              kind: { type: "string", enum: ["note", "url", "file"] },
              source: { type: "string" },
              content: { type: "string" }
            },
            required: ["title"],
            additionalProperties: false
          }
        },
        constraints: {
          type: "object",
          properties: {
            maxParallelWorkers: { type: "number" },
            maxAttemptsPerTask: { type: "number" },
            maxTotalMinutes: { type: "number" },
            requiresOwnerApprovalBeforeRun: { type: "boolean" }
          },
          additionalProperties: false
        }
      },
      required: ["title", "instruction"],
      additionalProperties: false
    }
  },
  {
    name: "local_company_start_run",
    description: "Start a planned Local Company run and continue until completion, blockage, failure, or run policy limit.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run id. If omitted, the latest active run is used." },
        mode: { type: "string", enum: ["plan_only", "until_next_decision", "until_complete"] },
        maxParallelWorkers: { type: "number" },
        notifyOnCompletion: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "local_company_get_run_status",
    description: "Read a Local Company run status without loading long artifact bodies.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run id. If omitted, the latest active run is used." }
      },
      additionalProperties: false
    }
  },
  {
    name: "local_company_list_notifications",
    description: "List lightweight Local Company notifications for low-cost Codex polling.",
    inputSchema: {
      type: "object",
      properties: {
        afterSequence: { type: "number" },
        limit: { type: "number" },
        includeSeen: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "local_company_mark_notifications_seen",
    description: "Mark Local Company notifications as seen up to a sequence.",
    inputSchema: {
      type: "object",
      properties: {
        sequence: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "local_company_list_artifacts",
    description: "List artifacts for a run. Does not include artifact body content.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Optional run id." }
      },
      additionalProperties: false
    }
  },
  {
    name: "local_company_get_artifact",
    description: "Get the current body of one Local Company artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" }
      },
      required: ["artifactId"],
      additionalProperties: false
    }
  },
  {
    name: "local_company_answer_decision",
    description: "Store the user's answer for a Local Company decision and unblock related work.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        decisionId: { type: "string" },
        selectedOption: { type: "string" },
        answer: { type: "string" }
      },
      required: ["decisionId", "selectedOption"],
      additionalProperties: false
    }
  },
  {
    name: "local_company_stop_run",
    description: "Safely stop a Local Company run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" }
      },
      required: ["runId"],
      additionalProperties: false
    }
  }
];

function paramsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  return typeof args[key] === "string" && args[key].trim() ? args[key].trim() : undefined;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = stringArg(args, key);
  if (!value) {
    throw new Error(`${key} 값이 필요합니다.`);
  }
  return value;
}

function numberArg(args: Record<string, unknown>, key: string): number | undefined {
  return typeof args[key] === "number" && Number.isFinite(args[key]) ? args[key] : undefined;
}

function booleanArg(args: Record<string, unknown>, key: string): boolean | undefined {
  return typeof args[key] === "boolean" ? args[key] : undefined;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Local Company request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function latestRunId(): Promise<string> {
  const dashboard = await requestJson<DashboardResponse>("/api/dashboard");
  const run = dashboard.activeRuns[0]?.run ?? dashboard.runs[0];
  if (!run) {
    throw new Error("사용할 Local Company run이 없습니다. 먼저 local_company_delegate_work를 호출하세요.");
  }
  return run.id;
}

function summarizeWorkspace(workspace: RunWorkspace): Record<string, unknown> {
  return {
    campaign: workspace.campaign,
    run: workspace.run,
    progress: workspace.progress,
    workers: workspace.workers,
    tasks: workspace.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      workerName: task.workerName,
      status: task.status,
      attempt: task.attempt,
      maxAttempts: task.maxAttempts,
      artifactIds: task.artifactIds
    })),
    artifacts: workspace.artifacts,
    decisions: workspace.decisions,
    recentNotifications: workspace.notifications
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "local_company_status") {
    return requestJson<DashboardResponse>("/api/dashboard");
  }

  if (name === "local_company_delegate_work") {
    const body: DelegateWorkRequest = {
      title: requiredString(args, "title"),
      instruction: requiredString(args, "instruction"),
      references: Array.isArray(args.references) ? (args.references as DelegateWorkRequest["references"]) : undefined,
      constraints: paramsObject(args.constraints) as DelegateWorkRequest["constraints"]
    };
    const response = await requestJson<DelegateWorkResponse>("/api/delegations", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return {
      ...response,
      workspace: summarizeWorkspace(response.workspace)
    };
  }

  if (name === "local_company_start_run") {
    const runId = stringArg(args, "runId") ?? (await latestRunId());
    const body: StartRunRequest = {
      mode: stringArg(args, "mode") as StartRunRequest["mode"],
      maxParallelWorkers: numberArg(args, "maxParallelWorkers"),
      notifyOnCompletion: booleanArg(args, "notifyOnCompletion")
    };
    const response = await requestJson<StartRunResponse>(`/api/runs/${encodeURIComponent(runId)}/start`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    return {
      ...response,
      workspace: summarizeWorkspace(response.workspace)
    };
  }

  if (name === "local_company_get_run_status") {
    const runId = stringArg(args, "runId") ?? (await latestRunId());
    return summarizeWorkspace(await requestJson<RunWorkspace>(`/api/runs/${encodeURIComponent(runId)}`));
  }

  if (name === "local_company_list_notifications") {
    const params = new URLSearchParams();
    const afterSequence = numberArg(args, "afterSequence");
    const limit = numberArg(args, "limit");
    if (afterSequence) {
      params.set("afterSequence", String(afterSequence));
    }
    if (limit) {
      params.set("limit", String(limit));
    }
    if (booleanArg(args, "includeSeen")) {
      params.set("includeSeen", "true");
    }
    return requestJson<ListNotificationsResponse>(`/api/notifications${params.size ? `?${params}` : ""}`);
  }

  if (name === "local_company_mark_notifications_seen") {
    return requestJson<MarkNotificationsSeenResponse>("/api/notifications/seen", {
      method: "POST",
      body: JSON.stringify({ sequence: numberArg(args, "sequence") })
    });
  }

  if (name === "local_company_list_artifacts") {
    const runId = stringArg(args, "runId");
    return requestJson(`/api/artifacts${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`);
  }

  if (name === "local_company_get_artifact") {
    return requestJson<ArtifactDetailResponse>(`/api/artifacts/${encodeURIComponent(requiredString(args, "artifactId"))}`);
  }

  if (name === "local_company_answer_decision") {
    const runId = stringArg(args, "runId") ?? (await latestRunId());
    const response = await requestJson<StartRunResponse>(
      `/api/runs/${encodeURIComponent(runId)}/decisions/${encodeURIComponent(requiredString(args, "decisionId"))}/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          selectedOption: requiredString(args, "selectedOption"),
          answer: stringArg(args, "answer")
        })
      }
    );
    return {
      ...response,
      workspace: summarizeWorkspace(response.workspace)
    };
  }

  if (name === "local_company_stop_run") {
    const runId = requiredString(args, "runId");
    const response = await requestJson<StartRunResponse>(`/api/runs/${encodeURIComponent(runId)}/stop`, { method: "POST" });
    return {
      ...response,
      workspace: summarizeWorkspace(response.workspace)
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function result(id: JsonRpcRequest["id"], value: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: value
  });
}

function errorResult(id: JsonRpcRequest["id"], error: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다."
    }
  });
}

async function handleRequest(request: JsonRpcRequest): Promise<string | null> {
  if (request.method === "initialize") {
    return result(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "local-company-v3", version: "0.1.0" }
    });
  }

  if (request.method === "tools/list") {
    return result(request.id, { tools });
  }

  if (request.method === "tools/call") {
    const params = paramsObject(request.params);
    const name = requiredString(params, "name");
    const args = paramsObject(params.arguments);
    const output = await callTool(name, args);
    return result(request.id, {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    });
  }

  if (request.method === "notifications/initialized") {
    return null;
  }

  throw new Error(`Unsupported method: ${request.method}`);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("line", (line) => {
  if (!line.trim()) {
    return;
  }

  void (async () => {
    let request: JsonRpcRequest | null = null;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
      const response = await handleRequest(request);
      if (response) {
        process.stdout.write(`${response}\n`);
      }
    } catch (error: unknown) {
      process.stdout.write(`${errorResult(request?.id ?? null, error)}\n`);
    }
  })();
});
