# V3 사용자 시나리오

## 시나리오 1. Codex에서 일을 맡긴다

1. 사용자가 Codex에게 말한다.

```text
이 기획 자료를 Local Company PM에게 맡겨서 앱 콘텐츠 산출물로 만들어줘.
완료되면 알려줘.
```

2. Codex가 첨부자료를 읽고 Local Company MCP를 호출한다.
3. Local Company는 참고자료를 저장한다.
4. PM은 목표, 작업, 산출물, 필요한 worker를 설계한다.
5. 실행 계획이 검증되면 run이 생성된다.
6. Codex가 실행을 시작한다.

## 시나리오 2. PM이 일을 쫙 뿌린다

1. PM은 작업을 여러 개의 task로 나눈다.
2. 각 task는 하나 이상의 artifact를 만든다.
3. PM은 worker 역할을 제안한다.
4. 실행 엔진은 worker별 Codex CLI 실행을 만든다.
5. 병렬 한도 안에서 여러 worker run이 진행된다.
6. 각 worker run은 결과를 artifact version으로 저장한다.

## 시나리오 3. 산출물 리뷰와 재작업

1. worker가 산출물을 저장한다.
2. PM reviewer가 산출물을 검토한다.
3. 결과는 세 가지 중 하나다.
   - 승인
   - 재작업 필요
   - 대표 결정 필요
4. 재작업이면 같은 artifact에 새 revision task를 만든다.
5. 대표 결정이 필요하면 run은 해당 지점에서 멈춘다.

## 시나리오 4. Codex가 완료를 알려준다

1. Local Company는 완료 이벤트를 저장한다.
2. Codex는 주기적으로 lightweight notification만 확인한다.
3. 새 완료 알림이 있으면 사용자에게 말한다.

```text
Local Company에서 "습관 형성 앱 콘텐츠 개발" 산출물 4개가 준비됐습니다.
같이 확인할까요?
```

4. 사용자가 원하면 Codex가 artifact 본문을 가져와 요약하거나 수정 의견을 작성한다.

## 시나리오 5. 대표 결정이 필요하다

1. PM reviewer가 위험한 확정, 외부 연락, 비용, 법무, 공개 약속 같은 항목을 발견한다.
2. Local Company는 decision을 만들고 run을 멈춘다.
3. Codex가 사용자에게 묻는다.
4. 사용자가 답하면 Codex가 `local_company_answer_decision`을 호출한다.
5. run은 이어서 진행된다.

## 시나리오 6. 상황판 확인

사용자는 웹앱을 열어 진행 상태를 본다.

- 현재 run 상태
- PM 계획
- worker별 진행 상태
- 작업 큐
- 산출물 목록
- 대표 확인 항목
- 최근 이벤트

상황판은 사람이 PM에게 직접 명령하는 곳이 아니다.

