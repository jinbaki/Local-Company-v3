import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { AlertCircle, CheckCircle2, FileText, Gauge, Loader2, RefreshCw, Square, Users } from "lucide-react";
import type { ArtifactDetailResponse, ArtifactKind, DashboardResponse, RunWorkspace } from "../shared/types.js";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "요청을 처리하지 못했습니다.");
  }

  return response.json() as Promise<T>;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "초안",
    planned: "계획됨",
    queued: "대기",
    running: "실행 중",
    blocked: "대표 확인 필요",
    failed: "실패",
    completed: "완료",
    stopped: "중지",
    requested: "요청됨",
    in_review: "PM 검토",
    needs_revision: "수정 필요",
    approved: "승인",
    open: "열림",
    answered: "답변 완료"
  };
  return labels[status] ?? status;
}

function badgeClass(status: string): string {
  if (["completed", "approved", "answered"].includes(status)) {
    return "badge success";
  }
  if (["running", "in_review"].includes(status)) {
    return "badge active";
  }
  if (["blocked", "needs_revision", "open"].includes(status)) {
    return "badge warning";
  }
  if (["failed", "stopped"].includes(status)) {
    return "badge danger";
  }
  return "badge neutral";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function artifactKindLabel(kind: ArtifactKind): string {
  const labels: Record<ArtifactKind, string> = {
    markdown: "MD",
    html: "HTML",
    json: "JSON",
    image: "IMAGE"
  };
  return labels[kind];
}

function prettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function imageSource(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  if (/^(data:image\/|https?:\/\/|\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  }
  return null;
}

export function App(): ReactElement {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<ArtifactDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const payload = await requestJson<DashboardResponse>("/api/dashboard");
      setDashboard(payload);
      setSelectedRunId((current) => current ?? payload.activeRuns[0]?.run.id ?? payload.runs[0]?.id ?? null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "상황판을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const selectedWorkspace = useMemo(() => {
    if (!dashboard || !selectedRunId) {
      return dashboard?.activeRuns[0] ?? null;
    }
    return dashboard.activeRuns.find((workspace) => workspace.run.id === selectedRunId) ?? null;
  }, [dashboard, selectedRunId]);

  async function openArtifact(artifactId: string): Promise<void> {
    setArtifact(await requestJson<ArtifactDetailResponse>(`/api/artifacts/${artifactId}`));
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">LC</div>
          <div>
            <strong>Local Company V3</strong>
            <span>Codex MCP execution engine</span>
          </div>
        </div>
        <nav className="run-list" aria-label="실행 목록">
          <p className="nav-label">Runs</p>
          {dashboard?.runs.length ? (
            dashboard.runs.map((run) => (
              <button
                className={run.id === selectedRunId ? "run-link selected" : "run-link"}
                key={run.id}
                type="button"
                onClick={() => {
                  setSelectedRunId(run.id);
                  setArtifact(null);
                }}
              >
                <span>{run.title}</span>
                <small>{statusLabel(run.status)}</small>
              </button>
            ))
          ) : (
            <p className="empty-side">아직 run이 없습니다.</p>
          )}
        </nav>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <p className="eyebrow">상황판</p>
            <h1>Codex가 맡긴 작업의 진행 상태</h1>
          </div>
          <button className="button" type="button" onClick={() => void loadDashboard()}>
            {loading ? <Loader2 size={16} /> : <RefreshCw size={16} />}
            새로고침
          </button>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {dashboard ? <Overview dashboard={dashboard} /> : null}
        {selectedWorkspace ? <RunDetail workspace={selectedWorkspace} onOpenArtifact={(id) => void openArtifact(id)} /> : null}
        {!selectedWorkspace && !loading ? <EmptyState /> : null}
        {artifact ? <ArtifactPanel detail={artifact} onClose={() => setArtifact(null)} /> : null}
      </main>
    </div>
  );
}

function Overview({ dashboard }: { dashboard: DashboardResponse }): ReactElement {
  return (
    <section className="overview">
      <Metric
        icon={Gauge}
        label="Active runs"
        value={String(dashboard.runs.filter((run) => !["completed", "failed", "stopped"].includes(run.status)).length)}
        detail={`${dashboard.runs.length} total`}
      />
      <Metric icon={AlertCircle} label="대표 확인" value={String(dashboard.openDecisions.length)} detail="open decisions" />
      <Metric icon={CheckCircle2} label="알림" value={String(dashboard.recentNotifications.length)} detail="recent events" />
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function RunDetail({ workspace, onOpenArtifact }: { workspace: RunWorkspace; onOpenArtifact: (artifactId: string) => void }): ReactElement {
  const completion =
    workspace.progress.totalTasks > 0 ? Math.round((workspace.progress.approvedTasks / workspace.progress.totalTasks) * 100) : 0;
  const failedWorkerRunByTask = new Map(
    workspace.workerRuns
      .filter((workerRun) => workerRun.status === "failed" && workerRun.errorSummary.trim())
      .map((workerRun) => [workerRun.taskId, workerRun.errorSummary])
  );

  return (
    <>
      <nav className="section-nav" aria-label="상황판 바로가기">
        <a href="#run-overview">개요</a>
        <a href="#run-artifacts">산출물 {workspace.artifacts.length}</a>
        <a href="#run-tasks">작업 {workspace.tasks.length}</a>
        <a href="#run-notifications">알림 {workspace.notifications.length}</a>
        {workspace.decisions.length ? <a href="#run-decisions">대표 확인 {workspace.decisions.length}</a> : null}
      </nav>
      <section className="run-grid">
        <div className="panel span-2" id="run-overview">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{workspace.campaign.title}</p>
              <h2>{workspace.run.title}</h2>
            </div>
            <span className={badgeClass(workspace.run.status)}>{statusLabel(workspace.run.status)}</span>
          </div>
          <p className="summary">{workspace.run.pmSummary || "PM 계획이 아직 없습니다."}</p>
          <div className="progress-track">
            <span style={{ width: `${completion}%` }} />
          </div>
          <div className="split">
            <span>작업 {workspace.progress.approvedTasks}/{workspace.progress.totalTasks}</span>
            <span>산출물 {workspace.progress.approvedArtifacts}/{workspace.progress.totalArtifacts}</span>
            <span>시작 {formatDate(workspace.run.startedAt)}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head compact">
            <h3>Workers</h3>
            <Users size={16} />
          </div>
          <div className="list">
            {workspace.workers.map((worker) => (
              <div className="list-row" key={worker.id}>
                <strong>{worker.name}</strong>
                <span>{worker.role}</span>
              </div>
            ))}
            {workspace.workers.length === 0 ? <p className="muted">worker 없음</p> : null}
          </div>
        </div>

        <div className="panel" id="run-notifications">
          <div className="panel-head compact">
            <h3>최근 알림</h3>
            <AlertCircle size={16} />
          </div>
          <div className="list">
            {workspace.notifications.map((notification) => (
              <div className="list-row" key={notification.id}>
                <strong>{notification.title}</strong>
                <span>{notification.summary}</span>
              </div>
            ))}
            {workspace.notifications.length === 0 ? <p className="muted">알림 없음</p> : null}
          </div>
        </div>

        <div className="panel span-2" id="run-artifacts">
          <div className="panel-head compact">
            <h3>산출물</h3>
            <FileText size={16} />
          </div>
          <div className="artifact-list">
            {workspace.artifacts.map((item) => (
              <button className="artifact-row" key={item.id} type="button" onClick={() => onOpenArtifact(item.id)}>
                <span>{item.title}</span>
                <small>{item.reviewSummary || `v${item.currentVersion ?? "-"}`}</small>
                <em className="type-chip">{artifactKindLabel(item.kind)}</em>
                <strong className={badgeClass(item.status)}>{statusLabel(item.status)}</strong>
              </button>
            ))}
            {workspace.artifacts.length === 0 ? <p className="muted">산출물 없음</p> : null}
          </div>
        </div>

        <div className="panel span-2 task-panel" id="run-tasks">
          <div className="panel-head compact">
            <h3>작업</h3>
          </div>
          <div className="table task-table">
            {workspace.tasks.map((task) => {
              const failureReason =
                task.status === "failed" ? (failedWorkerRunByTask.get(task.id) ?? "실패 이유가 기록되지 않았습니다.") : "";
              return (
                <div className="table-row task-row" key={task.id}>
                  <span className="task-title">{task.title}</span>
                  <span>{task.workerName ?? "미배정"}</span>
                  <span className={badgeClass(task.status)}>{statusLabel(task.status)}</span>
                  {failureReason ? <p className="task-failure">실패 이유: {failureReason}</p> : null}
                </div>
              );
            })}
          </div>
        </div>

        {workspace.decisions.length ? (
          <div className="panel span-2 warning-panel" id="run-decisions">
            <div className="panel-head compact">
              <h3>대표 확인 항목</h3>
              <Square size={16} />
            </div>
            {workspace.decisions.map((decision) => (
              <div className="decision" key={decision.id}>
                <strong>{decision.title}</strong>
                <p>{decision.reason}</p>
                <span className={badgeClass(decision.status)}>{statusLabel(decision.status)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}

function ArtifactContent({ detail }: { detail: ArtifactDetailResponse }): ReactElement {
  const content = detail.content || "";

  if (detail.artifact.kind === "html") {
    return (
      <div className="artifact-content">
        <div className="html-preview">
          <iframe title={detail.artifact.title} sandbox="" srcDoc={content || "<p>No HTML content yet.</p>"} />
        </div>
        <details className="artifact-source">
          <summary>HTML source</summary>
          <pre>{content || "No HTML content yet."}</pre>
        </details>
      </div>
    );
  }

  if (detail.artifact.kind === "json") {
    return (
      <div className="artifact-content">
        <pre>{prettyJson(content || "{}")}</pre>
      </div>
    );
  }

  if (detail.artifact.kind === "image") {
    const src = imageSource(content);
    return (
      <div className="artifact-content image-content">
        {src ? (
          <div className="image-preview">
            <img src={src} alt={detail.artifact.title} />
          </div>
        ) : (
          <pre>{content || "No image content yet."}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="artifact-content">
      <pre>{content || "No markdown content yet."}</pre>
    </div>
  );
}

function ArtifactPanel({ detail, onClose }: { detail: ArtifactDetailResponse; onClose: () => void }): ReactElement {
  return (
    <aside className="artifact-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">산출물</p>
          <h2>{detail.artifact.title}</h2>
          <div className="artifact-meta">
            <span className={badgeClass(detail.artifact.status)}>{statusLabel(detail.artifact.status)}</span>
            <span>{artifactKindLabel(detail.artifact.kind)}</span>
            <span>{detail.currentVersion ? `v${detail.currentVersion.version}` : "v-"}</span>
            <span>{formatDate(detail.artifact.updatedAt)}</span>
          </div>
        </div>
        <button className="button close-button" type="button" onClick={onClose} aria-label="Close artifact">
          닫기
        </button>
      </div>
      <ArtifactContent detail={detail} />
    </aside>
  );
}

function EmptyState(): ReactElement {
  return (
    <section className="empty">
      <h2>아직 실행 중인 작업이 없습니다.</h2>
      <p>Codex에서 Local Company MCP로 작업을 위임하면 이곳에 run, worker, 산출물이 나타납니다.</p>
    </section>
  );
}
