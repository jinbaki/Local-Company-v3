# Local Company V3

Local Company V3 is a local AI work orchestration system for Codex.

It lets you tell Codex what you want done, then have Codex delegate the work to a local PM engine through MCP. The PM creates a structured plan, dispatches Codex CLI workers, stores artifacts, reviews the results, and reports completion, blockers, or decisions back to Codex.

The web app is a dashboard, not the primary chat surface. You work with Codex; Local Company shows the current runs, worker activity, decisions, notifications, and artifacts.

## Core Flow

```text
User
  -> Codex
  -> Local Company MCP
  -> PM plan
  -> Codex CLI workers
  -> artifacts
  -> PM review
  -> notification back to Codex
```

## What It Does

- Accepts delegated work from Codex through MCP
- Lets the PM generate a constrained JSON plan
- Runs Codex CLI workers for planned tasks
- Stores artifact versions in the local workspace
- Supports the core artifact types: Markdown, HTML, JSON, and image
- Tracks run status, worker status, decisions, and notifications
- Provides a browser dashboard for monitoring work
- Keeps local data, logs, and credentials out of the public repository

## Requirements

- Node.js 24 or newer
- Codex CLI installed and signed in on the user's own machine
- A local Codex environment that can register MCP servers

Install or update Codex CLI:

```bash
npm install -g @openai/codex
codex
```

## Quick Start

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8789
```

On Windows, you can also run:

```text
start-local-company-v3.cmd
```

For Codex MCP use, the local server must be running. On Windows, register V3 to start automatically:

```text
install-local-company-v3-autostart.cmd
```

## MCP Setup

Start Local Company V3, then run:

```text
install-local-company-v3-mcp.cmd
```

The MCP server name is:

```text
local-company-v3
```

After registration, restart Codex and ask:

```text
Check Local Company V3 status.
```

If setup is unclear, give the whole project folder to Codex and ask:

```text
Please check this Local Company V3 folder and register the MCP server for my Codex.
```

## Public Release Safety

This repository is designed to be public-safe.

- `.env` files are ignored
- `data/` is ignored
- SQLite databases are ignored
- server logs are ignored
- `node_modules/` and build output are ignored
- Codex login credentials are not stored by the app

Run the public readiness check before publishing changes:

```bash
npm run check:public
```

## Documentation

- [Product Definition](docs/01-product-definition.md)
- [User Scenarios](docs/02-user-scenarios.md)
- [Install Guide](docs/install.md)
- [Codex MCP Setup](docs/codex-mcp-setup.md)
- [Windows Autostart](docs/autostart.md)
- [User Guide](docs/user-guide.md)
- [System Architecture](docs/specs/01-system-architecture.md)
- [MCP Contract](docs/specs/02-mcp-contract.md)
- [Data Model](docs/specs/03-data-model.md)
- [Runner Engine](docs/specs/04-runner-engine.md)
- [Dashboard UI](docs/specs/05-dashboard-ui.md)
- [PM Plan Schema](docs/specs/06-pm-plan-schema.md)
- [Implementation Roadmap](docs/implementation/01-roadmap.md)
- [Phase Tickets](docs/implementation/02-phase-tickets.md)
- [Public Release Security](docs/security/01-public-release-security.md)

## Current Status

Local Company V3 contains a runnable TypeScript/React/Node implementation with an MCP server, local API server, dashboard UI, SQLite storage, artifact storage, Codex CLI runner, tests, and public release checks.

---

# Local Company V3 한국어

Local Company V3는 Codex를 위한 로컬 AI 업무 오케스트레이션 시스템입니다.

사용자는 Codex에게 원하는 일을 말하고, Codex는 MCP를 통해 Local Company의 로컬 PM 엔진에 일을 위임합니다. PM은 구조화된 계획을 만들고, Codex CLI worker를 실행하고, 산출물을 저장하고, 결과를 검토한 뒤 완료, 막힘, 결정 요청을 Codex에게 다시 알려줍니다.

웹 앱은 PM과 직접 대화하는 화면이 아니라 상황판입니다. 사용자는 Codex와 대화하고, Local Company는 현재 실행 중인 작업, worker 상태, 결정 요청, 알림, 산출물을 보여줍니다.

## 핵심 흐름

```text
사용자
  -> Codex
  -> Local Company MCP
  -> PM 계획
  -> Codex CLI worker
  -> 산출물
  -> PM 검토
  -> Codex에게 알림
```

## 주요 기능

- Codex가 MCP를 통해 업무를 위임할 수 있습니다.
- PM이 제한된 JSON 형식으로 실행 계획을 만듭니다.
- 계획된 작업을 Codex CLI worker로 실행합니다.
- 산출물 버전을 로컬 작업 폴더에 저장합니다.
- 기본 산출물 타입인 Markdown, HTML, JSON, 이미지를 구분해서 관리하고 볼 수 있습니다.
- 실행 상태, worker 상태, 결정 요청, 알림을 추적합니다.
- 브라우저 상황판으로 전체 진행 상황을 확인합니다.
- 로컬 데이터, 로그, 인증 정보가 공개 저장소에 올라가지 않도록 구성되어 있습니다.

## 필요 조건

- Node.js 24 이상
- 사용자 본인 PC에 설치되고 로그인된 Codex CLI
- MCP 서버를 등록할 수 있는 로컬 Codex 환경

Codex CLI 설치 또는 업데이트:

```bash
npm install -g @openai/codex
codex
```

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:8789
```

Windows에서는 다음 파일을 실행해도 됩니다.

```text
start-local-company-v3.cmd
```

## MCP 연결

Local Company V3를 실행한 뒤 다음 파일을 실행합니다.

```text
install-local-company-v3-mcp.cmd
```

등록되는 MCP 서버 이름은 다음과 같습니다.

```text
local-company-v3
```

등록 후 Codex를 다시 열고 이렇게 요청합니다.

```text
Local Company V3 상태 확인해줘.
```

연결 방법을 모르겠다면 프로젝트 폴더 전체를 Codex에게 열어주고 이렇게 물어보면 됩니다.

```text
이 Local Company V3 폴더를 확인해서 내 Codex에 MCP 서버를 등록해줘.
```

## 공개 배포 안전 기준

이 저장소는 공개 배포를 전제로 구성되어 있습니다.

- `.env` 파일은 제외됩니다.
- `data/` 폴더는 제외됩니다.
- SQLite 데이터베이스는 제외됩니다.
- 서버 로그는 제외됩니다.
- `node_modules/`와 빌드 결과는 제외됩니다.
- 앱은 Codex 로그인 인증 정보를 저장하지 않습니다.

변경 사항을 공개하기 전 다음 검사를 실행하세요.

```bash
npm run check:public
```

## 문서

- [제품 정의](docs/01-product-definition.md)
- [사용자 시나리오](docs/02-user-scenarios.md)
- [설치 가이드](docs/install.md)
- [Codex MCP 연결](docs/codex-mcp-setup.md)
- [사용자 가이드](docs/user-guide.md)
- [시스템 아키텍처](docs/specs/01-system-architecture.md)
- [MCP 계약](docs/specs/02-mcp-contract.md)
- [데이터 모델](docs/specs/03-data-model.md)
- [실행 엔진](docs/specs/04-runner-engine.md)
- [상황판 UI](docs/specs/05-dashboard-ui.md)
- [PM 계획 스키마](docs/specs/06-pm-plan-schema.md)
- [구현 로드맵](docs/implementation/01-roadmap.md)
- [페이즈 티켓](docs/implementation/02-phase-tickets.md)
- [공개 배포 보안](docs/security/01-public-release-security.md)

## 현재 상태

Local Company V3에는 TypeScript, React, Node 기반의 실행 가능한 구현이 포함되어 있습니다. MCP 서버, 로컬 API 서버, 상황판 UI, SQLite 저장소, 산출물 저장소, Codex CLI runner, 테스트, 공개 배포 검사가 함께 들어 있습니다.
