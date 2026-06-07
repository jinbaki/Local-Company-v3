import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AppConfig } from "../config.js";
import { isCodexCliRunner } from "../config.js";
import type { PmPlan } from "../../shared/types.js";

export type ReviewResult = "approved" | "needs_revision" | "owner_decision";

export interface CodexExecInput {
  purpose: string;
  model: string;
  prompt: string;
}

export interface ReviewOutput {
  result: ReviewResult;
  summary: string;
  review: string;
}

function tempOutputPath(purpose: string): string {
  return path.join(os.tmpdir(), `local-company-v3-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
}

function buildCommand(bin: string, args: string[]): { command: string; args: string[] } {
  if (process.platform !== "win32") {
    return { command: bin, args };
  }

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/c", bin, ...args]
  };
}

function readOutput(outputPath: string, stdout: string): string {
  if (fs.existsSync(outputPath)) {
    const text = fs.readFileSync(outputPath, "utf8").trim();
    fs.rmSync(outputPath, { force: true });
    if (text) {
      return text;
    }
  }

  return stdout.trim();
}

export async function runCodexCli(config: AppConfig, input: CodexExecInput): Promise<string> {
  const outputPath = tempOutputPath(input.purpose);
  const args = ["exec", "-m", input.model, "--skip-git-repo-check", "--output-last-message", outputPath, "-"];
  const command = buildCommand(config.codexCliBin, args);

  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: config.rootDir,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      fs.rmSync(outputPath, { force: true });
      reject(new Error(`Codex CLI 실행 시간이 ${config.codexTimeoutMs}ms를 넘었습니다.`));
    }, config.codexTimeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      fs.rmSync(outputPath, { force: true });
      reject(new Error(`Codex CLI 실행에 실패했습니다: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        fs.rmSync(outputPath, { force: true });
        reject(new Error(`Codex CLI가 실패했습니다. ${stderr || stdout || `exit code ${code}`}`.trim()));
        return;
      }

      const output = readOutput(outputPath, stdout);
      if (!output) {
        reject(new Error("Codex CLI가 빈 응답을 반환했습니다."));
        return;
      }
      resolve(output);
    });
    child.stdin.end(input.prompt);
  });
}

export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("JSON 객체를 찾지 못했습니다.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function requestedCount(instruction: string): number {
  const match = /(\d+)\s*개/.exec(instruction);
  if (!match) {
    return 3;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 8)) : 3;
}

export function createMockPlan(title: string, instruction: string): PmPlan {
  const count = requestedCount(instruction);
  const artifacts = Array.from({ length: count }, (_, index) => ({
    clientId: `artifact_${index + 1}`,
    title: `${title} 산출물 ${index + 1}.md`,
    kind: "markdown" as const,
    expectedSections: ["목표", "핵심 내용", "실행안", "검토 기준"]
  }));

  return {
    summary: `${title} 요청을 ${count}개 산출물로 나누어 실행합니다.`,
    workers: [
      {
        clientId: "worker_planner",
        name: "기획 담당",
        role: "구조 설계",
        mission: "요청을 산출물 단위로 나누고 핵심 구조를 잡습니다."
      },
      {
        clientId: "worker_writer",
        name: "작성 담당",
        role: "본문 작성",
        mission: "PM 작업지시에 맞춰 대표가 검토할 수 있는 초안을 만듭니다."
      },
      {
        clientId: "worker_quality",
        name: "검수 담당",
        role: "품질 검토",
        mission: "누락, 위험 표현, 대표 결정 필요 항목을 점검합니다."
      }
    ],
    artifacts,
    tasks: artifacts.map((artifact, index) => ({
      clientId: `task_${index + 1}`,
      title: `${artifact.title} 작성`,
      workerRef: index % 2 === 0 ? "worker_writer" : "worker_planner",
      instructions: [
        `대표 요청: ${instruction}`,
        `산출물 "${artifact.title}"을 Markdown으로 작성하세요.`,
        "확정되지 않은 외부 사실은 확인 필요로 남기세요.",
        "결과는 바로 검토 가능한 문서 형태여야 합니다."
      ].join("\n"),
      acceptanceCriteria: "목표, 핵심 내용, 실행안, 검토 기준이 포함되어야 합니다.",
      artifactRefs: [artifact.clientId],
      priority: "high"
    })),
    decisions: [],
    runPolicy: {
      mode: "until_next_decision",
      maxParallelWorkers: 3,
      maxAttemptsPerTask: 2
    }
  };
}

export async function generatePlannerOutput(config: AppConfig, input: { title: string; instruction: string; references: string }): Promise<string> {
  if (!isCodexCliRunner(config)) {
    return JSON.stringify(createMockPlan(input.title, input.instruction), null, 2);
  }

  return runCodexCli(config, {
    purpose: "pm-plan",
    model: config.codexPmModel,
    prompt: [
      "You are the Local Company V3 PM planner.",
      "Create a JSON plan only. No prose outside JSON.",
      "The app is controlled by Codex through MCP. The user will not chat inside the app.",
      "",
      "Top-level schema:",
      '{"summary":"...","workers":[...],"tasks":[...],"artifacts":[...],"decisions":[],"runPolicy":{"mode":"until_next_decision","maxParallelWorkers":3,"maxAttemptsPerTask":2}}',
      "",
      "Worker schema:",
      '{"clientId":"worker_id","name":"...","role":"...","mission":"...","model":"optional"}',
      "",
      "Artifact schema:",
      '{"clientId":"artifact_id","title":"file-or-document-title.md","kind":"markdown","expectedSections":["..."]}',
      "",
      "Task schema:",
      '{"clientId":"task_id","title":"...","workerRef":"worker_id","instructions":"...","acceptanceCriteria":"...","dependsOn":[],"artifactRefs":["artifact_id"],"priority":"high"}',
      "",
      "Decision schema:",
      '{"clientId":"decision_id","title":"...","reason":"...","options":["...","..."],"recommendedOption":"...","blocks":["task_id"]}',
      "",
      "Rules:",
      "- Write Korean content.",
      "- Create 1-8 lean workers.",
      "- Create concrete tasks that produce artifacts.",
      "- Do not include local absolute paths.",
      "- Do not include external contact, payment, legal, medical, investment, or public-promise actions as executable tasks. Use decisions for those.",
      "- Prefer 2-5 artifacts unless the owner explicitly requested more.",
      "",
      `Title: ${input.title}`,
      "",
      "Owner instruction:",
      input.instruction,
      "",
      "References:",
      input.references || "없음"
    ].join("\n")
  });
}

export async function generateWorkerOutput(
  config: AppConfig,
  input: { workerName: string; taskTitle: string; instructions: string; acceptanceCriteria: string; references: string }
): Promise<string> {
  if (!isCodexCliRunner(config)) {
    return [
      `# ${input.taskTitle}`,
      "",
      "## 목표",
      "",
      `${input.workerName}이 PM 작업지시를 바탕으로 산출물 초안을 작성했습니다.`,
      "",
      "## 핵심 내용",
      "",
      input.instructions,
      "",
      "## 실행안",
      "",
      "- 요청을 산출물 단위로 정리했습니다.",
      "- 확인되지 않은 외부 사실은 단정하지 않았습니다.",
      "- 후속 검토가 가능하도록 구조를 나누었습니다.",
      "",
      "## 검토 기준",
      "",
      input.acceptanceCriteria || "PM이 검토 가능한 산출물이어야 합니다.",
      ""
    ].join("\n");
  }

  return runCodexCli(config, {
    purpose: "worker-run",
    model: config.codexWorkerModel,
    prompt: [
      "You are a Local Company V3 worker.",
      "Write the requested artifact in Korean Markdown.",
      "Do not claim unverified external facts.",
      "If owner approval is required, clearly mark it as 대표 확인 필요.",
      "",
      `Worker: ${input.workerName}`,
      `Task: ${input.taskTitle}`,
      "",
      "Instructions:",
      input.instructions,
      "",
      "Acceptance criteria:",
      input.acceptanceCriteria || "PM이 검토 가능한 산출물이어야 합니다.",
      "",
      "References:",
      input.references || "없음"
    ].join("\n")
  });
}

export async function generateReviewOutput(
  config: AppConfig,
  input: { artifactTitle: string; content: string; acceptanceCriteria: string }
): Promise<ReviewOutput> {
  if (!isCodexCliRunner(config)) {
    return {
      result: "approved",
      summary: "PM 리뷰를 통과했습니다.",
      review: ["# PM 리뷰", "", "판정: 승인", "", "- 산출물 구조와 완료 기준이 충족되었습니다.", ""].join("\n")
    };
  }

  const output = await runCodexCli(config, {
    purpose: "pm-review",
    model: config.codexReviewModel,
    prompt: [
      "You are a Local Company V3 PM reviewer.",
      "Return exactly one JSON object.",
      '{"result":"approved|needs_revision|owner_decision","summary":"short Korean summary","review":"Korean Markdown review"}',
      "",
      "Use owner_decision if the artifact asks for external contact, payment, legal judgement, medical/investment advice, or public promise.",
      "Use needs_revision if required sections or acceptance criteria are missing.",
      "",
      `Artifact title: ${input.artifactTitle}`,
      `Acceptance criteria: ${input.acceptanceCriteria || "없음"}`,
      "",
      "Content:",
      input.content
    ].join("\n")
  });

  const parsed = extractJsonObject(output) as Partial<ReviewOutput>;
  const result = parsed.result === "needs_revision" || parsed.result === "owner_decision" ? parsed.result : "approved";

  return {
    result,
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "PM 리뷰가 완료되었습니다.",
    review: typeof parsed.review === "string" && parsed.review.trim() ? parsed.review.trim() : output.trim()
  };
}
