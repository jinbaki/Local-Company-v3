import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { AlertCircle, CheckCircle2, FileText, Gauge, Loader2, RefreshCw, Server, Square, Users } from "lucide-react";
import type { ArtifactDetailResponse, DashboardResponse, RunWorkspace } from "../shared/types.js";

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
    in_review: "PM 리뷰",
    needs_revision: "재작업 필요",
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
      <Metric icon={Server} label="Codex runner" value={dashboard.health.runner.mode} detail={dashboard.health.runner.cliBin} />
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
  icon: typeof Server;
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

  return (
    <section className="run-grid">
      <div className="panel span-2">
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

      <div className="panel">
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

      <div className="panel span-2">
        <div className="panel-head compact">
          <h3>작업 큐</h3>
        </div>
        <div className="table">
          <div className="table-head">
            <span>작업</span>
            <span>담당</span>
            <span>상태</span>
            <span>시도</span>
          </div>
          {workspace.tasks.map((task) => (
            <div className="table-row" key={task.id}>
              <span>{task.title}</span>
              <span>{task.workerName ?? "미배정"}</span>
              <span className={badgeClass(task.status)}>{statusLabel(task.status)}</span>
              <span>
                {task.attempt}/{task.maxAttempts}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel span-2">
        <div className="panel-head compact">
          <h3>산출물</h3>
          <FileText size={16} />
        </div>
        <div className="artifact-list">
          {workspace.artifacts.map((item) => (
            <button className="artifact-row" key={item.id} type="button" onClick={() => onOpenArtifact(item.id)}>
              <span>{item.title}</span>
              <small>{item.reviewSummary || `v${item.currentVersion ?? "-"}`}</small>
              <strong className={badgeClass(item.status)}>{statusLabel(item.status)}</strong>
            </button>
          ))}
        </div>
      </div>

      {workspace.decisions.length ? (
        <div className="panel span-2 warning-panel">
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
            <span>{detail.currentVersion ? `v${detail.currentVersion.version}` : "v-"}</span>
            <span>{formatDate(detail.artifact.updatedAt)}</span>
          </div>
        </div>
        <button className="button close-button" type="button" onClick={onClose} aria-label="Close artifact">
          닫기
        </button>
      </div>
      <pre>{detail.content || "아직 본문이 없습니다."}</pre>
    </aside>
  );
}

function EmptyState(): ReactElement {
  return (
    <section className="empty">
      <h2>아직 실행된 작업이 없습니다.</h2>
      <p>Codex에서 Local Company MCP로 작업을 위임하면 이곳에 run, worker, 산출물이 나타납니다.</p>
    </section>
  );
}
