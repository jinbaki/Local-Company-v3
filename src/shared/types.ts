export type RunStatus = "draft" | "planned" | "queued" | "running" | "blocked" | "failed" | "completed" | "stopped";
export type TaskStatus = "queued" | "running" | "in_review" | "needs_revision" | "blocked" | "failed" | "approved";
export type ArtifactStatus = "requested" | "draft" | "in_review" | "needs_revision" | "approved";
export type WorkerRunStatus = "queued" | "running" | "failed" | "completed";
export type DecisionStatus = "open" | "answered";
export type ReferenceKind = "note" | "url" | "file";
export type ArtifactKind = "markdown" | "html" | "json" | "image";
export type RunMode = "plan_only" | "until_next_decision" | "until_complete";

export interface HealthResponse {
  status: "ok";
  app: "Local Company V3";
  generatedAt: string;
  host: string;
  port: number;
  dataDir: string;
  runner: {
    mode: string;
    cliBin: string;
    pmModel: string;
    workerModel: string;
    reviewModel: string;
    maxParallelWorkers: number;
  };
}

export interface WorkReferenceInput {
  title: string;
  kind?: ReferenceKind;
  source?: string;
  content?: string;
}

export interface DelegateWorkRequest {
  title: string;
  instruction: string;
  references?: WorkReferenceInput[];
  constraints?: {
    maxParallelWorkers?: number;
    maxAttemptsPerTask?: number;
    maxTotalMinutes?: number;
    requiresOwnerApprovalBeforeRun?: boolean;
  };
}

export interface StartRunRequest {
  mode?: RunMode;
  maxParallelWorkers?: number;
  notifyOnCompletion?: boolean;
}

export interface AnswerDecisionRequest {
  selectedOption: string;
  answer?: string;
}

export interface CampaignSummary {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunSummary {
  id: string;
  campaignId: string;
  campaignTitle: string;
  title: string;
  status: RunStatus;
  instruction: string;
  pmSummary: string;
  maxParallelWorkers: number;
  maxAttemptsPerTask: number;
  maxTotalMinutes: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ReferenceSummary {
  id: string;
  runId: string;
  title: string;
  kind: ReferenceKind;
  source: string;
  contentPreview: string;
  createdAt: string;
}

export interface WorkerSummary {
  id: string;
  runId: string;
  name: string;
  role: string;
  mission: string;
  model: string | null;
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  runId: string;
  workerId: string | null;
  workerName: string | null;
  title: string;
  instructions: string;
  acceptanceCriteria: string;
  status: TaskStatus;
  priority: string;
  attempt: number;
  maxAttempts: number;
  dependsOn: string[];
  artifactIds: string[];
  updatedAt: string;
}

export interface ArtifactSummary {
  id: string;
  runId: string;
  title: string;
  kind: ArtifactKind;
  status: ArtifactStatus;
  currentVersionId: string | null;
  currentVersion: number | null;
  reviewSummary: string;
  updatedAt: string;
}

export interface ArtifactVersionSummary {
  id: string;
  artifactId: string;
  version: number;
  createdBy: string;
  sourceWorkerRunId: string | null;
  path: string;
  createdAt: string;
}

export interface ArtifactDetailResponse {
  artifact: ArtifactSummary;
  currentVersion: ArtifactVersionSummary | null;
  content: string;
}

export interface WorkerRunSummary {
  id: string;
  runId: string;
  taskId: string;
  taskTitle: string;
  workerId: string | null;
  workerName: string | null;
  status: WorkerRunStatus;
  model: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  errorSummary: string;
}

export interface DecisionSummary {
  id: string;
  runId: string;
  title: string;
  reason: string;
  options: string[];
  recommendedOption: string;
  status: DecisionStatus;
  answer: string | null;
  blocks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSummary {
  sequence: number;
  id: string;
  type: string;
  runId: string | null;
  artifactId: string | null;
  title: string;
  summary: string;
  createdAt: string;
  seen: boolean;
}

export interface ListNotificationsResponse {
  notifications: NotificationSummary[];
  latestSequence: number;
  lastSeenSequence: number;
  unseenCount: number;
}

export interface MarkNotificationsSeenResponse {
  lastSeenSequence: number;
  unseenCount: number;
  message: string;
}

export interface PmPlanWorker {
  clientId: string;
  name: string;
  role: string;
  mission: string;
  model?: string;
}

export interface PmPlanArtifact {
  clientId: string;
  title: string;
  kind?: ArtifactKind;
  expectedSections?: string[];
}

export interface PmPlanTask {
  clientId: string;
  title: string;
  workerRef?: string;
  instructions: string;
  acceptanceCriteria?: string;
  dependsOn?: string[];
  artifactRefs: string[];
  priority?: string;
}

export interface PmPlanDecision {
  clientId: string;
  title: string;
  reason: string;
  options: string[];
  recommendedOption: string;
  blocks?: string[];
}

export interface PmPlan {
  summary: string;
  workers: PmPlanWorker[];
  tasks: PmPlanTask[];
  artifacts: PmPlanArtifact[];
  decisions?: PmPlanDecision[];
  runPolicy?: {
    mode?: RunMode;
    maxParallelWorkers?: number;
    maxAttemptsPerTask?: number;
  };
}

export interface RunWorkspace {
  campaign: CampaignSummary;
  run: RunSummary;
  references: ReferenceSummary[];
  workers: WorkerSummary[];
  tasks: TaskSummary[];
  artifacts: ArtifactSummary[];
  workerRuns: WorkerRunSummary[];
  decisions: DecisionSummary[];
  notifications: NotificationSummary[];
  progress: {
    totalTasks: number;
    approvedTasks: number;
    runningTasks: number;
    blockedTasks: number;
    failedTasks: number;
    totalArtifacts: number;
    approvedArtifacts: number;
  };
}

export interface DelegateWorkResponse {
  campaignId: string;
  runId: string;
  planStatus: "planned" | "blocked";
  pmSummary: string;
  taskCount: number;
  artifactCount: number;
  workerCount: number;
  requiresDecision: boolean;
  workspace: RunWorkspace;
}

export interface StartRunResponse {
  runId: string;
  status: RunStatus;
  message: string;
  workspace: RunWorkspace;
}

export interface DashboardResponse {
  health: HealthResponse;
  campaigns: CampaignSummary[];
  runs: RunSummary[];
  activeRuns: RunWorkspace[];
  recentNotifications: NotificationSummary[];
  openDecisions: DecisionSummary[];
}
