# V3 페이즈 티켓

## Phase 0. 프로젝트 골격

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-0-01 | package 초기화 | TypeScript, test, build script 준비 |
| V3-0-02 | config loader | `.env.example` 기준 설정 로드 |
| V3-0-03 | health API | local server health 응답 |
| V3-0-04 | public check | secret/path/data 제외 검사 |
| V3-0-05 | start script | Windows 실행 스크립트 |

## Phase 1. 데이터 모델

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-1-01 | SQLite migration | run 중심 schema 생성 |
| V3-1-02 | file store | campaign/run/artifact 폴더 생성 |
| V3-1-03 | run service | run 생성/조회/상태 변경 |
| V3-1-04 | artifact service | version 저장/조회 |
| V3-1-05 | notification service | cursor 기반 알림 조회 |

## Phase 2. MCP

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-2-01 | MCP server | JSON-RPC MCP 도구 목록 응답 |
| V3-2-02 | status tool | 앱/연결/run 요약 반환 |
| V3-2-03 | delegate tool | 요청/참고자료 저장 후 run planned 생성 |
| V3-2-04 | run status tool | 긴 본문 없이 상태 요약 반환 |
| V3-2-05 | notification tools | 새 알림 확인/읽음 처리 |

## Phase 3. PM Planner

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-3-01 | PM plan schema | worker/task/artifact/decision JSON schema |
| V3-3-02 | planner prompt | PM이 작업을 분해하도록 prompt 작성 |
| V3-3-03 | planner runner | Codex CLI로 PM plan 생성 |
| V3-3-04 | validator | 계획 검증과 오류 저장 |
| V3-3-05 | plan apply | 검증된 plan을 tasks/artifacts/workers로 반영 |

## Phase 4. Runner Engine

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-4-01 | start run | queued task를 실행 상태로 전환 |
| V3-4-02 | worker scheduler | 병렬 한도와 dependency 처리 |
| V3-4-03 | worker prompt | task별 산출물 생성 prompt |
| V3-4-04 | Codex worker exec | worker run 로그와 결과 저장 |
| V3-4-05 | artifact write | worker 결과를 artifact version으로 저장 |
| V3-4-06 | failure handling | 실패, 재시도, 한도 처리 |

## Phase 5. PM Review

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-5-01 | review prompt | 산출물 리뷰 JSON prompt |
| V3-5-02 | review runner | PM reviewer 실행 |
| V3-5-03 | approve flow | 승인 시 artifact approved |
| V3-5-04 | revision flow | 재작업 task 생성 |
| V3-5-05 | decision flow | 대표 확인 항목 생성 후 run blocked |

## Phase 6. Codex Follow-up

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-6-01 | run completed event | 완료 알림 생성 |
| V3-6-02 | artifact ready event | 산출물 준비 알림 생성 |
| V3-6-03 | blocked event | 대표 확인 필요 알림 생성 |
| V3-6-04 | MCP artifact list | 산출물 목록 조회 |
| V3-6-05 | MCP artifact get | 산출물 본문 조회 |
| V3-6-06 | MCP decision answer | Codex가 사용자 답변 저장 |

## Phase 7. Dashboard

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-7-01 | dashboard shell | 상황판 첫 화면 |
| V3-7-02 | run detail | PM 계획/큐/worker 표시 |
| V3-7-03 | artifact list | 산출물 상태와 열람 |
| V3-7-04 | timeline | 이벤트 타임라인 |
| V3-7-05 | connection panel | Codex 연결 상태 표시 |

## Phase 8. Public Release

| 티켓 | 작업 | 완료 기준 |
| --- | --- | --- |
| V3-8-01 | README | 설치/실행/MCP 설명 |
| V3-8-02 | install scripts | MCP 등록/해제 |
| V3-8-03 | sample data | 개인 정보 없는 샘플 |
| V3-8-04 | security check | secret scan 통과 |
| V3-8-05 | release review | 공개 전 점검 문서 |

