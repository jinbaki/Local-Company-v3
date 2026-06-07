# 설치와 실행

## 1. 의존성 설치

```bash
npm install
```

## 2. Local Company V3 실행

```bash
npm run dev
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:8789
```

Windows에서는 `start-local-company-v3.cmd`를 실행해도 된다.

V3는 로컬 실행 엔진이므로 Git clone으로 받은 폴더와 압축 파일로 받은 폴더 모두에서 실행될 수 있어야 한다. Codex CLI runner는 이 목적 때문에 Git 저장소 확인을 건너뛰는 옵션을 사용한다.

## 3. Codex CLI 로그인

Codex CLI를 설치하고 본인의 Codex 또는 ChatGPT 계정으로 로그인한다.

```bash
npm install -g @openai/codex
codex
```

자세한 연결 방식은 [Codex MCP 연결](codex-mcp-setup.md)을 참고한다.

## 4. MCP 등록

Windows에서는 다음 파일을 실행한다.

```text
install-local-company-v3-mcp.cmd
```

등록 후 Codex를 새로 열고 다음처럼 요청한다.

```text
Local Company V3 상태 확인해줘.
```

## 5. 공개 저장소 주의

`.env`, `data/`, SQLite DB, 실행 로그, Codex 인증 정보는 공개 저장소에 올리지 않는다.

## 6. Windows 자동실행

Codex가 MCP로 Local Company V3를 사용하려면 `http://127.0.0.1:8789` 로컬 서버가 실행 중이어야 한다.

Windows에서 로그인할 때 V3 서버를 자동으로 시작하려면 다음 파일을 실행한다.

```text
install-local-company-v3-autostart.cmd
```

자동실행을 해제하려면 다음 파일을 실행한다.

```text
uninstall-local-company-v3-autostart.cmd
```

자세한 내용은 [Windows 자동실행](autostart.md)을 참고한다.
