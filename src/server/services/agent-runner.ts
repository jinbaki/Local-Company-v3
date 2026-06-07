import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AppConfig } from "../config.js";
import { isCodexCliRunner } from "../config.js";
import type { ArtifactKind, PmPlan } from "../../shared/types.js";

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
      reject(new Error(`Codex CLI execution exceeded ${config.codexTimeoutMs}ms.`));
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
      reject(new Error(`Codex CLI failed to start: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        fs.rmSync(outputPath, { force: true });
        reject(new Error(`Codex CLI failed. ${stderr || stdout || `exit code ${code}`}`.trim()));
        return;
      }

      const output = readOutput(outputPath, stdout);
      if (!output) {
        reject(new Error("Codex CLI returned an empty response."));
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
    throw new Error("Could not find a JSON object in the model response.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function requestedCount(instruction: string): number {
  const match = /(\d+)/.exec(instruction);
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
    title: `${title} artifact ${index + 1}.md`,
    kind: "markdown" as const,
    expectedSections: ["Goal", "Content", "Execution", "Review criteria"]
  }));

  return {
    summary: `${title} will be split into ${count} artifact tasks.`,
    workers: [
      {
        clientId: "worker_planner",
        name: "Planning Worker",
        role: "Structure design",
        mission: "Split the request into artifact-sized work."
      },
      {
        clientId: "worker_writer",
        name: "Writing Worker",
        role: "Draft writing",
        mission: "Create reviewable artifact drafts from PM instructions."
      },
      {
        clientId: "worker_quality",
        name: "Quality Worker",
        role: "Review support",
        mission: "Check omissions, risky claims, and owner-decision needs."
      }
    ],
    artifacts,
    tasks: artifacts.map((artifact, index) => ({
      clientId: `task_${index + 1}`,
      title: `${artifact.title} draft`,
      workerRef: index % 2 === 0 ? "worker_writer" : "worker_planner",
      instructions: [
        `Owner request: ${instruction}`,
        `Create artifact "${artifact.title}" as ${artifact.kind}.`,
        "Do not claim unverified external facts.",
        "Make the result easy for the owner to review."
      ].join("\n"),
      acceptanceCriteria: "The artifact must include a goal, core content, execution notes, and review criteria.",
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

function escapeHtml(value: string): string {
  return value.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] ?? char);
}

function mockWorkerOutput(input: {
  artifactKind: ArtifactKind;
  artifactTitle: string;
  workerName: string;
  taskTitle: string;
  instructions: string;
  acceptanceCriteria: string;
}): string {
  if (input.artifactKind === "html") {
    return [
      "<!doctype html>",
      '<html lang="ko">',
      "<head>",
      '  <meta charset="utf-8" />',
      `  <title>${escapeHtml(input.artifactTitle)}</title>`,
      "  <style>",
      "    body { font-family: system-ui, sans-serif; margin: 32px; line-height: 1.7; color: #162033; }",
      "    section { max-width: 760px; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <section>",
      `    <h1>${escapeHtml(input.artifactTitle)}</h1>`,
      `    <p>${escapeHtml(input.workerName)} worker가 PM 지시에 맞춰 만든 HTML 산출물 예시입니다.</p>`,
      "    <h2>요청</h2>",
      `    <p>${escapeHtml(input.instructions)}</p>`,
      "    <h2>검토 기준</h2>",
      `    <p>${escapeHtml(input.acceptanceCriteria)}</p>`,
      "  </section>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  if (input.artifactKind === "json") {
    return JSON.stringify(
      {
        title: input.artifactTitle,
        worker: input.workerName,
        task: input.taskTitle,
        sections: ["goal", "content", "execution", "reviewCriteria"],
        request: input.instructions,
        acceptanceCriteria: input.acceptanceCriteria,
        status: "draft"
      },
      null,
      2
    );
  }

  if (input.artifactKind === "image") {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">',
      '  <rect width="1200" height="720" fill="#f8fafc"/>',
      '  <rect x="72" y="72" width="1056" height="576" rx="32" fill="#ffffff" stroke="#d9e0ea" stroke-width="4"/>',
      '  <text x="120" y="180" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#162033">Local Company V3</text>',
      `  <text x="120" y="260" font-family="Arial, sans-serif" font-size="32" fill="#475467">${escapeHtml(input.artifactTitle)}</text>`,
      '  <rect x="120" y="340" width="300" height="72" rx="16" fill="#dbeafe"/>',
      '  <text x="148" y="386" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1d4ed8">IMAGE ARTIFACT</text>',
      '  <text x="120" y="500" font-family="Arial, sans-serif" font-size="26" fill="#667085">Generated as an SVG preview for the artifact viewer.</text>',
      "</svg>"
    ].join("");
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }

  return [
    `# ${input.taskTitle}`,
    "",
    "## 목표",
    "",
    `${input.workerName} worker가 PM 작업지시를 바탕으로 산출물 초안을 작성했습니다.`,
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
    input.acceptanceCriteria || "PM이 검토할 수 있는 산출물이어야 합니다.",
    ""
  ].join("\n");
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
      '{"clientId":"artifact_id","title":"file-or-document-title.md","kind":"markdown|html|json|image","expectedSections":["..."]}',
      "",
      "Task schema:",
      '{"clientId":"task_id","title":"...","workerRef":"worker_id","instructions":"...","acceptanceCriteria":"...","dependsOn":[],"artifactRefs":["artifact_id"],"priority":"high"}',
      "",
      "Decision schema:",
      '{"clientId":"decision_id","title":"...","reason":"...","options":["...","..."],"recommendedOption":"...","blocks":["task_id"]}',
      "",
      "Rules:",
      "- Write Korean content unless the owner requests another language.",
      "- Supported artifact kinds are markdown, html, json, image.",
      "- Use markdown for written documents, html for interactive/readable previews, json for structured data, and image for visual outputs.",
      "- For image artifacts, ask workers for an image URL, data:image data URL, or SVG markup.",
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
      input.references || "None"
    ].join("\n")
  });
}

export async function generateWorkerOutput(
  config: AppConfig,
  input: {
    workerName: string;
    taskTitle: string;
    artifactTitle: string;
    artifactKind: ArtifactKind;
    instructions: string;
    acceptanceCriteria: string;
    references: string;
  }
): Promise<string> {
  if (!isCodexCliRunner(config)) {
    return mockWorkerOutput(input);
  }

  return runCodexCli(config, {
    purpose: "worker-run",
    model: config.codexWorkerModel,
    prompt: [
      "You are a Local Company V3 worker.",
      "Write the requested artifact in the requested output format.",
      "Supported artifact kinds: markdown, html, json, image.",
      "For markdown, return Markdown.",
      "For html, return a complete safe HTML document or fragment.",
      "For json, return valid JSON only.",
      "For image, return an image URL, a data:image/... data URL, or SVG markup.",
      "Do not claim unverified external facts.",
      "If owner approval is required, clearly mark it as 대표 확인 필요.",
      "",
      `Worker: ${input.workerName}`,
      `Task: ${input.taskTitle}`,
      `Artifact title: ${input.artifactTitle}`,
      `Artifact kind: ${input.artifactKind}`,
      "",
      "Instructions:",
      input.instructions,
      "",
      "Acceptance criteria:",
      input.acceptanceCriteria || "The artifact must be reviewable by the PM.",
      "",
      "References:",
      input.references || "None"
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
      summary: "PM review passed.",
      review: ["# PM Review", "", "Decision: approved", "", "- The artifact is structured enough for owner review.", ""].join("\n")
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
      `Acceptance criteria: ${input.acceptanceCriteria || "None"}`,
      "",
      "Content:",
      input.content
    ].join("\n")
  });

  const parsed = extractJsonObject(output) as Partial<ReviewOutput>;
  const result = parsed.result === "needs_revision" || parsed.result === "owner_decision" ? parsed.result : "approved";

  return {
    result,
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "PM review completed.",
    review: typeof parsed.review === "string" && parsed.review.trim() ? parsed.review.trim() : output.trim()
  };
}
