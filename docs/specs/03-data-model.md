# V3 데이터 모델

V3 데이터는 run 중심이다.

## 주요 엔티티

| 엔티티 | 설명 |
| --- | --- |
| `campaigns` | 일을 담는 컨테이너 |
| `runs` | PM이 설계하고 실행 엔진이 처리하는 실행 단위 |
| `references` | PM과 worker가 참고하는 자료 |
| `pm_plans` | PM이 만든 JSON 실행 계획 |
| `workers` | PM이 설계한 역할 |
| `tasks` | worker가 실행할 작업 |
| `artifacts` | 산출물 메타데이터 |
| `artifact_versions` | 산출물 버전과 파일 경로 |
| `worker_runs` | 실제 Codex CLI 실행 기록 |
| `reviews` | PM 리뷰 결과 |
| `decisions` | 대표 확인 항목 |
| `notifications` | Codex가 확인할 짧은 이벤트 |

## `runs`

| 필드 | 설명 |
| --- | --- |
| `id` | run id |
| `campaign_id` | campaign id |
| `title` | 실행 제목 |
| `status` | draft, planned, queued, running, blocked, failed, completed, stopped |
| `instruction` | Codex가 위임한 원 요청 |
| `pm_summary` | PM 계획 요약 |
| `max_parallel_workers` | 병렬 worker 한도 |
| `max_total_minutes` | 전체 실행 시간 한도 |
| `created_at` | 생성 시각 |
| `started_at` | 시작 시각 |
| `completed_at` | 완료 시각 |

## `pm_plans`

PM plan은 JSON 원문과 검증 결과를 모두 저장한다.

| 필드 | 설명 |
| --- | --- |
| `id` | plan id |
| `run_id` | run id |
| `raw_json` | PM이 반환한 JSON |
| `validated_json` | 서버 검증 후 사용 가능한 JSON |
| `status` | valid, invalid, superseded |
| `validation_errors` | 검증 실패 이유 |

## `tasks`

| 필드 | 설명 |
| --- | --- |
| `id` | task id |
| `run_id` | run id |
| `worker_id` | 담당 worker |
| `title` | 작업 제목 |
| `instructions` | PM 작업 지시 |
| `acceptance_criteria` | 완료 기준 |
| `status` | queued, running, in_review, needs_revision, blocked, failed, approved |
| `depends_on` | 선행 task id 배열 |
| `artifact_ids` | 생성할 artifact id 배열 |

## `worker_runs`

worker run은 실제 Codex CLI 실행 기록이다.

| 필드 | 설명 |
| --- | --- |
| `id` | worker run id |
| `run_id` | run id |
| `task_id` | task id |
| `worker_id` | worker id |
| `status` | queued, running, failed, completed |
| `model` | 사용 모델 |
| `started_at` | 시작 시각 |
| `finished_at` | 종료 시각 |
| `exit_code` | CLI 종료 코드 |
| `prompt_path` | 저장된 prompt 경로 |
| `output_path` | raw output 경로 |
| `error_path` | stderr 또는 오류 기록 경로 |

## `artifacts`

| 필드 | 설명 |
| --- | --- |
| `id` | artifact id |
| `run_id` | run id |
| `title` | 산출물 제목 |
| `kind` | markdown, html, json, image |
| `status` | requested, draft, in_review, needs_revision, approved |
| `current_version_id` | 최신 버전 |

## `notifications`

알림은 Codex polling을 위해 짧게 유지한다.

| 필드 | 설명 |
| --- | --- |
| `sequence` | 증가하는 번호 |
| `type` | run_completed, artifact_ready 등 |
| `run_id` | 관련 run |
| `artifact_id` | 관련 artifact |
| `title` | 짧은 제목 |
| `summary` | 짧은 요약 |
| `seen_at` | 확인 시각 |

## 파일 구조

```text
data/
  campaigns/
    <campaignId>/
      references/
      runs/
        <runId>/
          plan/
          prompts/
          worker-runs/
          artifacts/
          briefs/
```

공식 상태는 SQLite에 있고, 산출물 본문과 실행 로그는 파일로 보관한다.
