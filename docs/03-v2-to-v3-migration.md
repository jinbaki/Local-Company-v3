# V2에서 V3로 가져올 것과 버릴 것

## 가져올 것

| V2 요소 | V3 사용 방식 |
| --- | --- |
| Codex CLI 연결 | PM, worker, review 실행에 사용 |
| MCP 등록 스크립트 | V3 MCP 서버 등록에 재사용 |
| SQLite 상태 관리 | run, task, artifact, notification 관리 |
| 파일 기반 산출물 저장 | artifact version 저장에 유지 |
| PM action JSON 검증 | V3 PM plan JSON 검증으로 발전 |
| 작업 큐 | run engine의 핵심으로 유지 |
| PM 리뷰/재작업 | 산출물 품질 루프로 유지 |
| 알림 이벤트 | Codex notification polling으로 유지 |
| 공개 보안 검사 | V3 공개 배포 기준으로 유지 |

## 버릴 것

| V2 요소 | 이유 |
| --- | --- |
| PM 채팅 중심 UI | 사용자는 Codex와 대화해야 한다 |
| 자동 실행 버튼 중심 흐름 | MCP가 실행을 시작하고 엔진이 끝까지 돌려야 한다 |
| 인계 보고서 | 용어가 부정확하다. 운영 브리프/완료 브리프로 대체한다 |
| mock 대화 중심 기본값 | 공개 목적과 맞지 않는다 |
| 사업부/조직 UI 과다 노출 | V3 초기 경험은 run과 artifact 중심이어야 한다 |

## 필요한 재설계

1. Conversation 중심에서 Run 중심으로 이동한다.
2. Campaign은 유지하되, 사용자가 직접 꾸미는 공간보다 실행 컨테이너로 본다.
3. Worker session은 실제 실행 기록인 worker run으로 바꾼다.
4. MCP 도구는 사람 UI를 대신하는 공식 입력 채널이 된다.
5. Dashboard는 읽기 중심으로 만든다.

## V2 데이터 호환

초기 V3는 V2 데이터를 직접 마이그레이션하지 않는다.

이유:

- V2의 conversation 중심 데이터가 V3의 run 중심 데이터와 맞지 않는다.
- 공개 버전에서 사용자의 기존 로컬 데이터가 섞이면 보안 점검이 어려워진다.
- 필요한 코드는 가져오되 데이터는 새로 시작하는 편이 명확하다.

추후 필요하면 V2 artifact 파일만 읽어오는 importer를 별도 도구로 만든다.

