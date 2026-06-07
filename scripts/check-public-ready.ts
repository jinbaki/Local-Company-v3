import fs from "node:fs";
import path from "node:path";

interface CheckItem {
  label: string;
  passed: boolean;
  evidence: string;
}

const root = process.cwd();
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY\s*=\s*[^#\s][^\r\n]+/,
  /ANTHROPIC_API_KEY\s*=\s*[^#\s][^\r\n]+/,
  /GITHUB_TOKEN\s*=\s*[^#\s][^\r\n]+/,
  /[A-Za-z]:\\Users\\[^\\\s"'`]+/i,
  /[A-Za-z]:\\[^\\\r\n"'`]*\\local-company-v3/i
];

const scanTargets = [
  ".env.example",
  ".gitignore",
  "README.md",
  "LICENSE",
  "package.json",
  "docs",
  "scripts",
  "src",
  "tests",
  "data-sample"
];

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listTextFiles(target: string): string[] {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    return [absolute];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (["node_modules", "dist", "data", ".git"].includes(entry.name)) {
      continue;
    }

    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTextFiles(path.relative(root, child)));
      continue;
    }

    if (/\.(ts|tsx|js|json|md|txt|css|html|example|gitignore|cmd)$/i.test(entry.name) || entry.name === "LICENSE") {
      files.push(child);
    }
  }

  return files;
}

function scanForSecrets(): string[] {
  const hits: string[] = [];
  const files = scanTargets.flatMap(listTextFiles);

  for (const file of files) {
    if (path.relative(root, file).split(path.sep).join("/") === "scripts/check-public-ready.ts") {
      continue;
    }

    const text = fs.readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        hits.push(path.relative(root, file));
        break;
      }
    }
  }

  return Array.from(new Set(hits)).sort();
}

const gitignore = exists(".gitignore") ? read(".gitignore") : "";
const packageJson = exists("package.json") ? read("package.json") : "";
const envExample = exists(".env.example") ? read(".env.example") : "";
const secretHits = scanForSecrets();

const checks: CheckItem[] = [
  {
    label: "environment example",
    passed:
      exists(".env.example") &&
      envExample.includes("LOCAL_COMPANY_PORT=8789") &&
      envExample.includes("LOCAL_COMPANY_DATA_DIR=./data") &&
      envExample.includes("CODEX_RUNNER=codex-cli") &&
      !/[A-Za-z]:\\/.test(envExample),
    evidence: ".env.example has portable V3 values"
  },
  {
    label: "install docs",
    passed:
      exists("docs/install.md") &&
      read("docs/install.md").includes("npm install") &&
      read("docs/install.md").includes("install-local-company-v3-mcp.cmd"),
    evidence: "docs/install.md explains app and MCP setup"
  },
  {
    label: "mcp docs",
    passed:
      exists("docs/codex-mcp-setup.md") &&
      read("docs/codex-mcp-setup.md").includes("local_company_delegate_work") &&
      read("docs/codex-mcp-setup.md").includes("local_company_start_run"),
    evidence: "docs/codex-mcp-setup.md lists V3 MCP tools"
  },
  {
    label: "dashboard user guide",
    passed: exists("docs/user-guide.md") && read("docs/user-guide.md").includes("PM 채팅창은 없다"),
    evidence: "user guide describes Codex-first usage"
  },
  {
    label: "public ignore list",
    passed:
      gitignore.includes(".env") &&
      gitignore.includes("data/") &&
      gitignore.includes("logs/") &&
      gitignore.includes("node_modules/") &&
      gitignore.includes("dist/") &&
      gitignore.includes("*.sqlite"),
    evidence: ".gitignore excludes secrets, local data, dependencies, build outputs, and SQLite files"
  },
  {
    label: "scripts",
    passed:
      exists("start-local-company-v3.cmd") &&
      exists("install-local-company-v3-mcp.cmd") &&
      exists("uninstall-local-company-v3-mcp.cmd") &&
      packageJson.includes("\"mcp:local-company\""),
    evidence: "start and MCP scripts exist"
  },
  {
    label: "license note",
    passed: exists("LICENSE") && read("LICENSE").includes("All rights reserved"),
    evidence: "LICENSE"
  },
  {
    label: "secret scan",
    passed: secretHits.length === 0,
    evidence: secretHits.length === 0 ? "no obvious API keys or private paths in public text files" : secretHits.join(", ")
  }
];

for (const item of checks) {
  const marker = item.passed ? "PASS" : "FAIL";
  console.log(`[${marker}] ${item.label}`);
  console.log(`       ${item.evidence}`);
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Public readiness check failed: ${failed.length} item(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log("Public readiness check passed.");
}
