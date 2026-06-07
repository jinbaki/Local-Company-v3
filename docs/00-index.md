# Local Company V3 문서 인덱스

V3의 기준은 다음 한 문장이다.

> Local Company V3는 Codex가 MCP로 호출하는 로컬 AI 회사 실행 엔진이다.

사용자는 Codex와 대화한다. Local Company 웹 화면은 PM 채팅 앱이 아니라 실행 상황과 산출물을 보는 상황판이다.

## 문서

| 문서 | 목적 |
| --- | --- |
| `01-product-definition.md` | 제품 정의, 원칙, V2와의 차이 |
| `02-user-scenarios.md` | Codex에서 PM에게 일을 맡기는 사용자 시나리오 |
| `03-v2-to-v3-migration.md` | V2에서 가져올 것과 버릴 것 |
| `specs/01-system-architecture.md` | 전체 시스템 구조 |
| `specs/02-mcp-contract.md` | Codex가 호출할 MCP 도구 계약 |
| `specs/03-data-model.md` | 실행, 작업, 직원, 산출물, 알림 데이터 모델 |
| `specs/04-runner-engine.md` | PM/worker/review Codex CLI 실행 엔진 |
| `specs/05-dashboard-ui.md` | 상황판 UI 명세 |
| `specs/06-pm-plan-schema.md` | PM 계획 JSON 계약 초안 |
| `implementation/01-roadmap.md` | 구현 순서 |
| `implementation/02-phase-tickets.md` | 페이즈별 티켓 |
| `implementation/03-first-mvp-scope.md` | 첫 MVP 범위 |
| `security/01-public-release-security.md` | 공개 저장소 보안 기준 |

## 용어 변경

V2의 "인계 보고서"라는 표현은 V3에서 사용하지 않는다.

| V2 표현 | V3 표현 |
| --- | --- |
| 인계 보고서 | 운영 브리프 |
| 자동 실행 시작 | 실행 시작 |
| PM 대화 | Codex 위임 |
| 직원 세션 | worker run |
| 사람 TODO | 대표 확인 항목 |
