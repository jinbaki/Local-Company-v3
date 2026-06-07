# V3 MCP 계약

MCP는 V3의 공식 조작 인터페이스다. 사람은 Codex와 대화하고, Codex가 아래 도구를 호출한다.

## 도구 목록

| 도구 | 목적 |
| --- | --- |
| `local_company_status` | 앱 실행 상태, Codex 연결, active run 요약 확인 |
| `local_company_delegate_work` | 사용자 요청과 참고자료를 PM에게 위임하고 plan 생성 |
| `local_company_start_run` | 검증된 PM plan을 실행 시작 |
| `local_company_get_run_status` | run 진행률, worker, task, artifact, decision 상태 확인 |
| `local_company_list_notifications` | 새 완료/실패/결정/산출물 알림 확인 |
| `local_company_mark_notifications_seen` | 확인한 알림 위치 저장 |
| `local_company_list_artifacts` | 캠페인/run 산출물 목록 확인 |
| `local_company_get_artifact` | 산출물 최신 버전 또는 특정 버전 본문 확인 |
| `local_company_answer_decision` | 대표 확인 항목에 사용자 답변 저장 |
| `local_company_stop_run` | 실행 중인 run을 안전 중지 |

## `local_company_delegate_work`

Codex가 사용자의 요청을 Local Company PM에게 맡기는 핵심 도구다.

입력:

```json
{
  "title": "앱 콘텐츠 산출물 제작",
  "instruction": "첨부 가이드를 기준으로 MVP 트랙 상세 문서를 만들어줘.",
  "references": [
    {
      "title": "콘텐츠 제작 가이드",
      "kind": "file",
      "source": "content-authoring-guide.md",
      "content": "..."
    }
  ],
  "constraints": {
    "maxParallelWorkers": 3,
    "requiresOwnerApprovalBeforeRun": false
  }
}
```

출력:

```json
{
  "campaignId": "campaign-...",
  "runId": "run-...",
  "planStatus": "planned",
  "pmSummary": "...",
  "taskCount": 8,
  "artifactCount": 8,
  "workerCount": 3,
  "requiresDecision": false
}
```

## `local_company_start_run`

검증된 run을 실행한다.

입력:

```json
{
  "runId": "run-...",
  "mode": "until_complete",
  "maxParallelWorkers": 3,
  "notifyOnCompletion": true
}
```

출력:

```json
{
  "runId": "run-...",
  "status": "running",
  "queuedTaskCount": 8,
  "runningWorkerCount": 3
}
```

## `local_company_get_run_status`

Codex가 중간 상태를 볼 때 사용한다.

출력은 긴 산출물 본문을 포함하지 않는다. 본문은 `local_company_get_artifact`로 별도 요청한다.

## `local_company_list_notifications`

저비용 polling 전용이다.

반환 이벤트:

- `run_completed`
- `run_blocked`
- `run_failed`
- `artifact_ready`
- `artifact_approved`
- `decision_requested`
- `worker_failed`

## 안전 규칙

- MCP는 로컬 서버만 호출한다.
- 삭제 도구는 초기 공개 버전에 넣지 않는다.
- `start_run`은 실행 비용이 발생할 수 있으므로 run 한도와 병렬 한도를 받는다.
- 외부 연락, 결제, 공개 배포, 법무 판단은 worker가 실행하지 않고 decision으로 올린다.

