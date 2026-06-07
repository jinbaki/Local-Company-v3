# Windows Autostart

Local Company V3 MCP talks to the local HTTP server at `http://127.0.0.1:8789`.

That means the Local Company V3 server must be running before Codex can use the MCP tools. On Windows, the easiest setup is to register Local Company V3 in the current user's Startup folder.

## Enable Autostart

Run:

```text
install-local-company-v3-autostart.cmd
```

This creates a shortcut named `Local Company V3.lnk` in the Windows Startup folder.

On the next Windows sign-in, Local Company V3 starts the local server in the background. It does not open the dashboard automatically.

To open the dashboard manually:

```text
start-local-company-v3.cmd
```

## Disable Autostart

Run:

```text
uninstall-local-company-v3-autostart.cmd
```

## Migrating From V2

If V2 is still registered in Codex, remove the old MCP entry:

```bash
codex mcp remove local-company
```

Then register V3:

```text
install-local-company-v3-mcp.cmd
```

If a V2 server is already running on `8788`, stop that process before using V3.

## Korean

Local Company V3 MCP는 `http://127.0.0.1:8789` 로컬 서버와 통신합니다.

따라서 Codex에서 Local Company V3 MCP를 쓰려면 먼저 V3 서버가 실행 중이어야 합니다. Windows에서는 시작프로그램에 등록해두는 방식이 가장 단순합니다.

자동실행 등록:

```text
install-local-company-v3-autostart.cmd
```

자동실행 해제:

```text
uninstall-local-company-v3-autostart.cmd
```

대시보드를 직접 열 때:

```text
start-local-company-v3.cmd
```

V2에서 넘어오는 경우에는 기존 MCP를 제거하고 V3 MCP를 등록합니다.

```bash
codex mcp remove local-company
```

```text
install-local-company-v3-mcp.cmd
```

V2 서버가 `8788`에서 실행 중이면 먼저 종료한 뒤 V3를 사용하세요.
