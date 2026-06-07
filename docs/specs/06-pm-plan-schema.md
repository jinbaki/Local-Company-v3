# PM Plan JSON Schema Draft

PM은 자유롭게 생각하되, Local Company에 반영할 계획은 JSON 계약 안에 넣어야 한다.

## 최상위 형태

```json
{
  "summary": "PM 계획 요약",
  "goals": [],
  "workers": [],
  "tasks": [],
  "artifacts": [],
  "decisions": [],
  "runPolicy": {
    "mode": "until_next_decision",
    "maxParallelWorkers": 3,
    "maxAttemptsPerTask": 2
  }
}
```

## Worker

```json
{
  "clientId": "worker_content_planner",
  "name": "콘텐츠 기획자",
  "role": "콘텐츠 구조 설계",
  "mission": "트랙 구조와 스킬노드 체계를 설계한다.",
  "model": "gpt-5.5"
}
```

규칙:

- worker는 1명 이상 8명 이하.
- 이름, 역할, 임무는 필수.
- 모델은 생략 가능하며 생략 시 worker 기본 모델을 쓴다.

## Task

```json
{
  "clientId": "task_hydration_track",
  "title": "수분 관리 트랙 상세 문서 작성",
  "workerRef": "worker_content_planner",
  "instructions": "참고자료 기준에 맞춰 트랙 상세 문서를 작성한다.",
  "acceptanceCriteria": "필수 항목 9개가 모두 포함되어야 한다.",
  "dependsOn": [],
  "artifactRefs": ["artifact_hydration_track"],
  "priority": "high"
}
```

규칙:

- task는 workerRef 또는 PM 자체 실행 중 하나를 가져야 한다.
- artifactRefs가 있으면 해당 artifact가 존재해야 한다.
- dependsOn은 같은 plan 안의 task clientId만 참조할 수 있다.

## Artifact

```json
{
  "clientId": "artifact_hydration_track",
  "title": "skilllog-track-health-hydration.md",
  "kind": "markdown",
  "expectedSections": [
    "트랙 개요",
    "스킬노드 목록",
    "노드 연결표",
    "스킬 목록",
    "퀘스트 목록",
    "오늘의 todo 변환 문장",
    "대체 퀘스트",
    "최종 스킬 카드와 칭호",
    "참고 근거와 안전/주의 문구"
  ]
}
```

규칙:

- artifact는 1개 이상.
- kind는 `markdown`, `html`, `json`, `file_bundle` 중 하나.
- 파일명은 로컬 경로가 아니라 산출물명이어야 한다.

## Decision

```json
{
  "clientId": "decision_safety_policy",
  "title": "건강 관련 문구 기준 확인",
  "reason": "운동/수면/감정 기록 문구의 안전 기준을 대표가 정해야 한다.",
  "options": ["보수적 문구로 진행", "대표가 별도 기준 제공"],
  "recommendedOption": "보수적 문구로 진행",
  "blocks": ["task_light_strength_track"]
}
```

규칙:

- 비용, 외부 연락, 법무, 공개 약속, 의료/투자/계약 판단은 decision으로 올린다.
- decision이 blocks를 가지면 해당 task는 실행하지 않는다.

## 검증 실패 예

- 존재하지 않는 workerRef
- 존재하지 않는 artifactRef
- task 없는 artifact
- artifact 없는 task
- worker 8명 초과
- 외부 파일 절대 경로 포함
- 삭제, 외부 발송, 결제 같은 금지 액션 포함
