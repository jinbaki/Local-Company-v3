# V3 시스템 아키텍처

## 전체 구조

```text
Codex
  |
  | MCP
  v
Local Company MCP Server
  |
  v
Local Company Core API
  |
  +--> PM Planner
  +--> Run Engine
  +--> Worker Runner
  +--> PM Reviewer
  +--> Artifact Store
  +--> Notification Store
  |
  v
Dashboard
```

## 주요 컴포넌트

| 컴포넌트 | 역할 |
| --- | --- |
| MCP Server | Codex가 Local Company를 조작하는 공식 입구 |
| Core API | 로컬 HTTP API. MCP와 Dashboard가 같이 사용 |
| PM Planner | 사용자 요청과 참고자료를 PM plan JSON으로 변환 |
| Plan Validator | PM plan이 허용된 구조인지 검증 |
| Run Engine | 작업 큐를 끝까지 실행하고 중단 조건을 관리 |
| Worker Runner | Codex CLI worker를 실행하고 산출물을 저장 |
| PM Reviewer | 산출물을 승인/재작업/대표 결정 필요로 판정 |
| Artifact Store | 산출물 버전과 파일 저장 |
| Decision Store | 대표 확인 항목 저장 |
| Notification Store | Codex가 가볍게 확인할 이벤트 저장 |
| Dashboard | run, worker, artifact, decision 상태 표시 |

## 실행 상태 흐름

```text
draft
  -> planned
  -> queued
  -> running
  -> reviewing
  -> blocked | failed | completed
```

## 로컬 우선 원칙

- HTTP 서버는 `127.0.0.1`에만 바인딩한다.
- 외부 공개 서버를 열지 않는다.
- Codex CLI 인증은 사용자 PC의 Codex 설정을 사용한다.
- Local Company는 비밀번호, API key, Codex 토큰을 저장하지 않는다.

## Dashboard 역할

Dashboard는 다음을 하지 않는다.

- PM에게 직접 채팅 명령 보내기
- 작업을 하나씩 수동으로 실행하기
- PM 계획을 임의로 편집하기

Dashboard는 다음을 한다.

- 실행 상태 확인
- 산출물 열람
- 대표 확인 항목 표시
- Codex 연결 상태 표시
- 필요 시 안전 중지 상태 표시

