# Codex MCP 연결

Local Company V3는 Codex가 MCP로 호출하는 로컬 실행 엔진이다.

## 연결 흐름

1. Local Company V3 서버를 실행한다.
2. Codex CLI에 본인 계정으로 로그인한다.
3. `install-local-company-v3-mcp.cmd`를 실행한다.
4. Codex 새 대화에서 Local Company V3 도구를 사용한다.

## 등록되는 MCP 이름

```text
local-company-v3
```

## 주요 도구

| 도구 | 역할 |
| --- | --- |
| `local_company_status` | 실행 상태와 최근 알림 확인 |
| `local_company_delegate_work` | PM에게 작업 위임 |
| `local_company_start_run` | run 실행 시작 |
| `local_company_get_run_status` | run 진행 상태 확인 |
| `local_company_list_notifications` | 새 알림 확인 |
| `local_company_mark_notifications_seen` | 알림 확인 위치 저장 |
| `local_company_list_artifacts` | 산출물 목록 확인 |
| `local_company_get_artifact` | 산출물 본문 확인 |
| `local_company_answer_decision` | 대표 확인 항목 답변 |
| `local_company_stop_run` | run 중지 |

## 예시 요청

```text
이 가이드를 Local Company V3 PM에게 맡겨서 콘텐츠 산출물 3개를 만들고,
완료되면 알려줘.
```

Codex는 참고자료를 저장하고, PM 계획을 만들고, run을 시작하고, 알림을 확인한 뒤 사용자에게 결과를 알려준다.

## 다른 사용자의 사용

이 MCP 연결은 저장소 소유자의 Codex 계정을 공유하지 않는다. 각 사용자는 자신의 PC에서 저장소를 설치하고, 자신의 Codex 계정으로 로그인한 뒤 MCP를 등록한다.

V3 runner는 폴더를 Git clone이 아니라 압축 파일로 받은 경우도 실행할 수 있도록 Codex CLI 실행 시 Git 저장소 확인을 건너뛴다. Local Company 서버는 그래도 로컬 `127.0.0.1`에서만 열린다.

잘 모르겠다면 프로젝트 폴더를 Codex에 열고 이렇게 물어본다.

```text
이 폴더의 Local Company V3 MCP 연결 방법을 확인해서 내 Codex에 등록해줘.
```
