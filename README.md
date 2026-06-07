# Local Company V3

Local Company V3 is a local AI company execution engine controlled by Codex through MCP.

The user talks to Codex. Codex delegates work to Local Company. Local Company lets a PM split the work, run Codex CLI workers, store artifacts, review results, and notify Codex when the work is done or blocked.

The web app is not a PM chat app. It is a status dashboard for runs, workers, decisions, and artifacts.

## Product Sentence

Local Company V3 is a local execution engine where Codex delegates work to an AI PM, the PM dispatches Codex CLI workers, and the system returns managed artifacts.

## Core Flow

```text
Codex
  -> Local Company MCP
  -> PM plan
  -> work queue
  -> Codex CLI workers
  -> artifacts
  -> PM review
  -> notification back to Codex
```

## What V3 Keeps From V2

- Codex CLI connection and account-local execution
- MCP setup direction
- SQLite plus file-based artifact storage
- Work queue, PM review, revision, and owner-decision concepts
- Lightweight notification events
- Public release security checks

## What V3 Removes From V2

- In-app PM chat as the primary interface
- Manual "run next task" button as the main execution path
- Ambiguous handoff report language
- UI-first business division and campaign workflows
- Mock conversation as the public default experience

## Initial Documents

- [Product Definition](docs/01-product-definition.md)
- [User Scenarios](docs/02-user-scenarios.md)
- [Install Guide](docs/install.md)
- [Codex MCP Setup](docs/codex-mcp-setup.md)
- [User Guide](docs/user-guide.md)
- [System Architecture](docs/specs/01-system-architecture.md)
- [MCP Contract](docs/specs/02-mcp-contract.md)
- [Data Model](docs/specs/03-data-model.md)
- [Runner Engine](docs/specs/04-runner-engine.md)
- [Dashboard UI](docs/specs/05-dashboard-ui.md)
- [PM Plan Schema](docs/specs/06-pm-plan-schema.md)
- [Implementation Roadmap](docs/implementation/01-roadmap.md)
- [Phase Tickets](docs/implementation/02-phase-tickets.md)
- [First MVP Scope](docs/implementation/03-first-mvp-scope.md)
- [Public Release Security](docs/security/01-public-release-security.md)

## Current Status

This folder contains the V3 product definition and implementation plan. It is ready for scaffolding the actual app, but it does not yet contain the runtime implementation.
