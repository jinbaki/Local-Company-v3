# V3 Runner Engine 명세

Runner Engine은 V3의 핵심이다. 사용자가 버튼을 누르는 대신, Codex가 MCP로 실행을 시작하면 엔진이 가능한 범위까지 스스로 진행한다.

## 목표

```text
PM 계획
  -> task queue
  -> Codex CLI worker runs
  -> artifacts
  -> PM review
  -> revision or approval
  -> completion notification
```

## 실행 모드

| 모드 | 설명 |
| --- | --- |
| `plan_only` | PM 계획만 만들고 실행하지 않음 |
| `until_next_decision` | 대표 결정이 필요하거나 완료될 때까지 실행 |
| `until_complete` | 실패, 중지, 한도 도달, 완료까지 실행 |

초기 기본값은 `until_next_decision`이다.

## 병렬 실행

- `RUN_MAX_PARALLEL_WORKERS` 기본값은 3이다.
- 같은 artifact를 쓰는 task는 동시에 실행하지 않는다.
- dependency가 남아 있는 task는 실행하지 않는다.
- PM review는 worker run 이후 실행한다.

## Codex CLI 실행

worker 실행은 `codex exec`를 사용한다.

각 실행은 다음 파일을 남긴다.

```text
prompts/<workerRunId>.md
worker-runs/<workerRunId>/stdout.md
worker-runs/<workerRunId>/stderr.txt
worker-runs/<workerRunId>/result.md
```

## 상태 전이

```text
task queued
  -> worker_run running
  -> artifact draft
  -> pm_review running
  -> approved | needs_revision | blocked | failed
```

## PM 리뷰 결과

| 결과 | 처리 |
| --- | --- |
| `approved` | artifact 승인 |
| `needs_revision` | revision task 생성 |
| `owner_decision` | decision 생성, 관련 task/run blocked |
| `failed` | 재시도 또는 run failed |

## 재시도 정책

- worker task는 기본 2회까지 재시도한다.
- 같은 artifact 재작업은 기본 2회까지 허용한다.
- 한도를 넘으면 decision 또는 failed로 전환한다.

## 완료 조건

run은 다음 조건을 만족하면 `completed`가 된다.

- 모든 task가 approved 또는 skipped
- 열린 decision 없음
- 실행 중 worker run 없음
- 재작업 큐 없음

완료되면 `run_completed`와 `artifact_approved` 알림을 만든다.

## 중단 조건

run은 다음 경우 멈춘다.

- 대표 결정 필요
- 실행 시간 한도 도달
- 반복 실패
- Codex CLI 연결 실패
- 사용자가 MCP로 stop 요청

## 비용과 사용량 제어

- run별 최대 시간
- worker 병렬 수
- task별 최대 재시도
- 모델별 timeout
- 긴 산출물 본문은 알림 polling에 포함하지 않음

