# V3 구현 로드맵

## Phase 0. 프로젝트 골격

목표:

- V3 폴더와 문서 확정
- Node/TypeScript 프로젝트 초기화
- 로컬 API 서버와 상태 확인 endpoint 생성
- 공개 보안 검사 스크립트 준비

완료 기준:

- `npm test`, `npm run check:public` 준비
- `.env.example`만 공개
- data/log/secret 제외

## Phase 1. Run 중심 데이터 모델

목표:

- SQLite schema 작성
- campaigns, runs, references, pm_plans, workers, tasks, artifacts, artifact_versions, worker_runs, reviews, decisions, notifications 구현

완료 기준:

- run 생성/조회 가능
- artifact version 파일 저장 가능
- notification cursor 저장 가능

## Phase 2. MCP 기본 도구

목표:

- V3 MCP 서버 구현
- `status`, `delegate_work`, `get_run_status`, `list_notifications`, `mark_notifications_seen` 구현

완료 기준:

- Codex가 Local Company 상태를 읽고 work delegation을 생성할 수 있음

## Phase 3. PM Planner

목표:

- Codex CLI PM planner 실행
- PM plan JSON schema 작성
- plan validation 구현

완료 기준:

- 사용자 요청과 참고자료로 task/artifact/worker plan 생성
- invalid plan은 실행하지 않고 이유 저장

## Phase 4. Runner Engine

목표:

- `start_run` 구현
- task dependency 처리
- worker run 생성
- Codex CLI worker 실행
- artifact version 저장

완료 기준:

- MCP로 run을 시작하면 산출물 초안이 생성됨

## Phase 5. PM Review Loop

목표:

- PM reviewer 실행
- approved / needs_revision / owner_decision 처리
- 재작업 task 생성
- decision 생성

완료 기준:

- 산출물이 PM 리뷰를 거쳐 승인 또는 재작업됨
- 대표 결정 필요 시 run이 blocked 됨

## Phase 6. Notification + Codex Follow-up

목표:

- completion/block/failure/artifact notification 구현
- MCP notification tools 안정화

완료 기준:

- Codex가 lightweight polling으로 완료를 알 수 있음

## Phase 7. Dashboard

목표:

- 상황판 UI 구현
- active runs, queue, workers, artifacts, decisions, timeline 표시

완료 기준:

- 사람이 웹에서 전체 진행 상황을 이해할 수 있음
- PM 채팅 UI 없음

## Phase 8. Public Release

목표:

- README, 설치 안내, MCP 등록 안내 작성
- 보안 검사 강화
- sample data 제공

완료 기준:

- 다른 사용자가 자신의 Codex 계정으로 설치 가능
- 개인 정보 없이 공개 가능

