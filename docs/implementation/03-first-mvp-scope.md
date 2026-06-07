# 첫 MVP 범위

V3 첫 MVP는 "상황판 있는 MCP 실행 엔진"의 가장 작은 형태다.

## MVP에서 반드시 되는 것

1. Codex가 MCP로 일을 위임한다.
2. PM planner가 JSON 계획을 만든다.
3. 서버가 계획을 검증하고 run을 만든다.
4. Codex가 MCP로 run을 시작한다.
5. worker Codex CLI가 산출물 초안을 만든다.
6. PM reviewer가 산출물을 승인하거나 재작업/대표 결정 필요로 판정한다.
7. 완료 또는 막힘 알림이 생긴다.
8. Codex가 알림을 확인하고 사용자에게 알려준다.
9. 상황판에서 run과 산출물 상태를 볼 수 있다.

## MVP에서 제외하는 것

- 웹 PM 채팅
- 복잡한 조직 관리
- 실시간 push notification
- 외부 배포 서버
- 여러 사용자의 동시 접속
- 결제/외부 연락 자동 실행
- V2 데이터 마이그레이션

## MVP 테스트 문장

```text
Codex, 이 가이드를 Local Company PM에게 맡겨서
콘텐츠 트랙 산출물 3개를 만들고 완료되면 알려줘.
```

성공하면 Codex는 다음을 할 수 있어야 한다.

- 참고자료 저장
- PM 계획 생성
- run 시작
- 진행 상태 확인
- 완료 알림 확인
- 산출물 본문 조회

## MVP 산출물

- `README.md`
- MCP 설치 안내
- V3 dashboard
- PM plan schema
- run engine
- artifact store
- notification tools
- public security check

