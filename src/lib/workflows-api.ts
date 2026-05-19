import { apiGet, apiPost } from "@/lib/api";
import type {
  ApproveWorkflowInput,
  DraftWorkflowInput,
  GenerateAuthorIntentInput,
  GenerateAuthorIntentResult,
  GenerateStageSummaryInput,
  GenerateStageSummaryResult,
  PlanWorkflowInput,
  WorkflowBaseInput,
  WorkflowTaskType,
  WorkflowTaskView,
} from "@/lib/types";

function withDefaultManualEntityRefs<T extends { manualEntityRefs?: PlanWorkflowInput["manualEntityRefs"] }>(input: T): T & {
  manualEntityRefs: NonNullable<PlanWorkflowInput["manualEntityRefs"]>;
} {
  return {
    ...input,
    manualEntityRefs: input.manualEntityRefs ?? {
      characterIds: [],
      factionIds: [],
      itemIds: [],
      hookIds: [],
      relationIds: [],
      worldSettingIds: [],
    },
  };
}

export function generateAuthorIntent(input: GenerateAuthorIntentInput) {
  return apiPost<GenerateAuthorIntentResult, GenerateAuthorIntentInput>("/api/workflows/author-intent", withDefaultManualEntityRefs(input));
}

export function startAuthorIntentTask(input: GenerateAuthorIntentInput) {
  return apiPost<WorkflowTaskView, GenerateAuthorIntentInput>("/api/workflows/author-intent/tasks", withDefaultManualEntityRefs(input));
}

export function runPlan(input: PlanWorkflowInput) {
  return apiPost<unknown, PlanWorkflowInput>("/api/workflows/plan", withDefaultManualEntityRefs(input));
}

export function startPlanTask(input: PlanWorkflowInput) {
  return apiPost<WorkflowTaskView, PlanWorkflowInput>("/api/workflows/plan/tasks", withDefaultManualEntityRefs(input));
}

export function generateStageSummary(input: GenerateStageSummaryInput) {
  return apiPost<GenerateStageSummaryResult, GenerateStageSummaryInput>("/api/workflows/stage-summary", input);
}

export function runDraft(input: DraftWorkflowInput) {
  return apiPost<unknown, DraftWorkflowInput>("/api/workflows/draft", input);
}

export function startDraftTask(input: DraftWorkflowInput) {
  return apiPost<WorkflowTaskView, DraftWorkflowInput>("/api/workflows/draft/tasks", input);
}

export function startReviewTask(input: WorkflowBaseInput) {
  return apiPost<WorkflowTaskView, WorkflowBaseInput>("/api/workflows/review/tasks", input);
}

export function startRepairTask(input: WorkflowBaseInput) {
  return apiPost<WorkflowTaskView, WorkflowBaseInput>("/api/workflows/repair/tasks", input);
}

export function startApproveTask(input: ApproveWorkflowInput) {
  return apiPost<WorkflowTaskView, ApproveWorkflowInput>("/api/workflows/approve/tasks", input);
}

export function getWorkflowTask(taskId: number) {
  return apiGet<WorkflowTaskView>(`/api/workflow-tasks/${taskId}`);
}

export function terminateWorkflowTask(taskId: number) {
  return apiPost<WorkflowTaskView, Record<string, never>>(`/api/workflow-tasks/${taskId}/terminate`, {});
}

export function getLatestChapterWorkflowTask(bookId: number, chapterNo: number, workflowType: WorkflowTaskType) {
  return apiGet<WorkflowTaskView | null>(
    `/api/books/${bookId}/chapters/${chapterNo}/workflow-tasks/latest?type=${workflowType}`,
  );
}

export function listChapterWorkflowTasks(bookId: number, chapterNo: number, limit = 20) {
  return apiGet<WorkflowTaskView[]>(
    `/api/books/${bookId}/chapters/${chapterNo}/workflow-tasks?limit=${limit}`,
  );
}

export function runReview(input: WorkflowBaseInput) {
  return apiPost<unknown, WorkflowBaseInput>("/api/workflows/review", input);
}

export function runRepair(input: WorkflowBaseInput) {
  return apiPost<unknown, WorkflowBaseInput>("/api/workflows/repair", input);
}

export function runApprove(input: ApproveWorkflowInput) {
  return apiPost<unknown, ApproveWorkflowInput>("/api/workflows/approve", input);
}

