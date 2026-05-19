import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";

import { ResourceEditorForm } from "@/components/resources/ResourceEditorForm";
import {
  buildResourceFormFromItem,
  buildResourceSavePayload,
  getResourceFormValidationMessage,
  getResourcePrimaryFieldValue,
  saveResourceRecord,
  type EditableResourceKey,
  type EditableResourceRecord,
  type PickerSources,
  type ResourceEditorFormState,
} from "@/components/resources/resource-editor-shared";
import {
  getChapter,
  getChapterWorkflowState,
  getChapterStage,
  listChapterStageHistory,
  listChapters,
  updateChapterStage,
} from "@/lib/chapters-api";
import { formatApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";
import {
  listCharacters,
  listFactions,
  listItems,
  listRelations,
  listStoryHooks,
  listWorldSettings,
} from "@/lib/resources-api";
import { getUserRuntimeSettings } from "@/lib/user-settings-api";
import { chapterWorkbenchPath, parseBookId, parseChapterNo, settingsPath } from "@/lib/routes";
import type {
  ChapterStage,
  ChapterStageHistoryEntry,
  CharacterView,
  FactionView,
  ItemView,
  PlanWorkflowInput,
  RelationView,
  StoryHookView,
  WorkflowTaskType,
  WorkflowTaskView,
  WorldSettingView,
} from "@/lib/types";
import { parseIdList } from "@/lib/utils";
import {
  generateStageSummary,
  getLatestChapterWorkflowTask,
  getWorkflowTask,
  listChapterWorkflowTasks,
  runApprove,
  startApproveTask,
  startAuthorIntentTask,
  startDraftTask,
  startPlanTask,
  startRepairTask,
  startReviewTask,
  terminateWorkflowTask,
} from "@/lib/workflows-api";

type StageTab = ChapterStage | "task";

const stages: Array<{ key: StageTab; label: string }> = [
  { key: "plan", label: "Plan" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "final", label: "Final" },
  { key: "task", label: "Task" },
];

const workflowActions = ["plan", "draft", "review", "repair", "approve"] as const;
const historyLimitOptions = [10, 20, 50] as const;

type WorkflowAction = (typeof workflowActions)[number];
type ManualEntityRefs = NonNullable<PlanWorkflowInput["manualEntityRefs"]>;
type FeedbackState = {
  kind: "idle" | "running" | "success" | "error";
  title: string;
  detail: string;
};

type WorkflowStatusCardViewModel = {
  tone: FeedbackState["kind"];
  eyebrow: string;
  title: string;
  detail: string;
  badge?: string;
  progressPercent: number | null;
  meta: string[];
};

type ResourceOption = {
  id: number;
  name: string;
  subtitle?: string | null;
};

type WorkflowProvider = NonNullable<PlanWorkflowInput["provider"]>;
type WorkflowModelOverrides = {
  lowModel: string;
  midModel: string;
  highModel: string;
};
type ChapterWorkbenchLocationState = {
  provider?: WorkflowProvider;
  lowModel?: string;
  midModel?: string;
  highModel?: string;
};
type StoredWorkflowSettings = WorkflowModelOverrides & {
  provider: WorkflowProvider;
  targetWords: string;
};

type WorkflowRunRequest = {
  action: WorkflowAction;
  dryRun?: boolean;
  authorIntentOverride?: string;
};

type ResourceEditorState = {
  resourceType: EditableResourceKey;
  resourceId: number;
};

const emptyManualEntityRefs: ManualEntityRefs = {
  characterIds: [],
  factionIds: [],
  itemIds: [],
  hookIds: [],
  relationIds: [],
  worldSettingIds: [],
};

const resourceSelectorPageSize = 8;

function formatActionLabel(action: string) {
  return action.replaceAll("_", " ");
}

function getStageWordCount(content: string) {
  return content.replace(/\s+/g, "").length;
}

function getWorkflowTaskTypeLabel(type: WorkflowTaskType) {
  if (type === "author_intent") return "authorIntent";
  if (type === "plan") return "Plan";
  if (type === "draft") return "Draft";
  if (type === "review") return "Review";
  if (type === "repair") return "Repair";
  return "Approve";
}

function getWorkflowTaskStatusLabel(status: WorkflowTaskView["status"]) {
  if (status === "pending") return "排队中";
  if (status === "running") return "执行中";
  if (status === "terminating") return "终止中";
  if (status === "terminated") return "已终止";
  if (status === "succeeded") return "已完成";
  return "失败";
}

function getWorkflowTaskStageLabel(stage: string | null) {
  if (!stage) {
    return "等待调度";
  }

  const labels: Record<string, string> = {
    queued: "任务排队中",
    loading_chapter: "加载章节数据",
    retrieving_initial_context: "检索初始上下文",
    generating_author_intent: "生成作者意图",
    extracting_intent_keywords: "提取意图关键词",
    retrieving_final_context: "检索最终上下文",
    generating_plan: "生成计划",
    loading_plan_context: "加载计划上下文",
    generating_draft: "生成草稿",
    repairing_length: "修正篇幅",
    generating_review: "生成审阅意见",
    loading_review_context: "加载审阅上下文",
    generating_repair: "生成修订稿",
    generating_final: "生成定稿",
    extracting_diff: "提取结构化变更",
    updating_resources: "更新资源实体",
    persisting_sidecar_artifacts: "写入检索附属产物",
    saving_artifacts: "保存阶段产物",
  };

  return labels[stage] ?? stage.replaceAll("_", " ");
}

function getWorkflowTaskResultMeta(task: WorkflowTaskView) {
  const meta: string[] = [];
  if (task.currentPlanId) {
    meta.push(`Plan #${task.currentPlanId}`);
  }
  if (task.currentDraftId) {
    meta.push(`Draft #${task.currentDraftId}`);
  }
  const result = task.result as { reviewId?: number; finalId?: number } | null;
  if (result?.reviewId) {
    meta.push(`Review #${result.reviewId}`);
  }
  if (result?.finalId) {
    meta.push(`Final #${result.finalId}`);
  }
  return meta;
}

function formatTaskPayload(value: unknown) {
  if (value == null) {
    return "—";
  }

  const maxLength = 1000;
  const text = (() => {
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  })();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n... 已截断，剩余 ${text.length - maxLength} 个字符未显示`;
}

function getWorkflowStatusCardViewModel(
  task: WorkflowTaskView | null,
  feedback: FeedbackState,
): WorkflowStatusCardViewModel {
  if (task) {
    const typeLabel = getWorkflowTaskTypeLabel(task.workflowType);
    const statusLabel = getWorkflowTaskStatusLabel(task.status);
    const stageLabel = getWorkflowTaskStageLabel(task.stage);
    const baseMeta = [
      `任务 #${task.id}`,
      statusLabel,
      ...(task.startedAt ? [new Date(task.startedAt).toLocaleString("zh-CN")] : []),
      ...getWorkflowTaskResultMeta(task),
    ];

    if (task.status === "pending" || task.status === "running" || task.status === "terminating") {
      return {
        tone: "running",
        eyebrow: `${typeLabel} Task`,
        title: task.status === "terminating" ? `${typeLabel} 正在终止` : `${typeLabel} 正在执行`,
        detail: task.status === "terminating" ? `终止请求已提交，当前阶段：${stageLabel}` : `当前阶段：${stageLabel}`,
        badge: statusLabel,
        progressPercent: task.progressPercent,
        meta: baseMeta,
      };
    }

    if (task.status === "succeeded") {
      return {
        tone: "success",
        eyebrow: `${typeLabel} Task`,
        title: `${typeLabel} 已完成`,
        detail: `最近一次任务已完成，当前阶段停留在：${stageLabel}`,
        badge: statusLabel,
        progressPercent: task.progressPercent,
        meta: [
          ...baseMeta,
          ...(task.finishedAt ? [`完成于 ${new Date(task.finishedAt).toLocaleString("zh-CN")}`] : []),
        ],
      };
    }

    if (task.status === "terminated") {
      return {
        tone: "idle",
        eyebrow: `${typeLabel} Task`,
        title: `${typeLabel} 已终止`,
        detail: task.error?.message ?? `任务已在阶段 ${stageLabel} 停止。`,
        badge: statusLabel,
        progressPercent: task.progressPercent,
        meta: [
          ...baseMeta,
          ...(task.finishedAt ? [`结束于 ${new Date(task.finishedAt).toLocaleString("zh-CN")}`] : []),
        ],
      };
    }

    return {
      tone: "error",
      eyebrow: `${typeLabel} Task`,
      title: `${typeLabel} 执行失败`,
      detail: task.error?.message ?? `最近一次任务失败在：${stageLabel}`,
      badge: statusLabel,
      progressPercent: task.progressPercent,
      meta: [
        ...baseMeta,
        ...(task.finishedAt ? [`结束于 ${new Date(task.finishedAt).toLocaleString("zh-CN")}`] : []),
      ],
    };
  }

  return {
    tone: feedback.kind,
    eyebrow: "Workflow Status",
    title: feedback.title,
    detail: feedback.detail,
    progressPercent: null,
    meta: [],
  };
}

function getResourceSubtitle(option: ResourceOption) {
  return option.subtitle ? <div className="mt-1 text-[11px] text-slate-500">{option.subtitle}</div> : null;
}

function getWorkflowSettingsStorageKey(bookIdValue: number, chapterNoValue: number) {
  return `chapter-workbench-workflow-settings:${bookIdValue}:${chapterNoValue}`;
}

function loadStoredWorkflowSettings(
  bookIdValue: number,
  chapterNoValue: number,
  preset: ChapterWorkbenchLocationState | null,
  userDefaults?: { provider: WorkflowProvider } & WorkflowModelOverrides,
): StoredWorkflowSettings {
  const fallback: StoredWorkflowSettings = {
    provider: preset?.provider ?? userDefaults?.provider ?? "mock",
    lowModel: preset?.lowModel ?? userDefaults?.lowModel ?? "",
    midModel: preset?.midModel ?? userDefaults?.midModel ?? "",
    highModel: preset?.highModel ?? userDefaults?.highModel ?? "",
    targetWords: "3000",
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(getWorkflowSettingsStorageKey(bookIdValue, chapterNoValue));
  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredWorkflowSettings>;
    return {
      provider: parsed.provider ?? fallback.provider,
      lowModel: typeof parsed.lowModel === "string" && parsed.lowModel.trim().length > 0 ? parsed.lowModel : fallback.lowModel,
      midModel: typeof parsed.midModel === "string" && parsed.midModel.trim().length > 0 ? parsed.midModel : fallback.midModel,
      highModel: typeof parsed.highModel === "string" && parsed.highModel.trim().length > 0 ? parsed.highModel : fallback.highModel,
      targetWords: typeof parsed.targetWords === "string" ? parsed.targetWords : fallback.targetWords,
    };
  } catch {
    return fallback;
  }
}

function getDiffPreview(current: ChapterStageHistoryEntry | undefined, previous: ChapterStageHistoryEntry | undefined) {
  if (!current) {
    return null;
  }

  if (!previous) {
    return {
      summary: "这是当前阶段的首个版本。",
      addedLines: current.content.split(/\r?\n/).filter((line) => line.trim()).slice(0, 6),
      removedLines: [] as string[],
    };
  }

  const currentLines = current.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const previousLines = previous.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const previousSet = new Set(previousLines);
  const currentSet = new Set(currentLines);

  return {
    summary: `对比 v${previous.versionNo} → v${current.versionNo}`,
    addedLines: currentLines.filter((line) => !previousSet.has(line)).slice(0, 6),
    removedLines: previousLines.filter((line) => !currentSet.has(line)).slice(0, 6),
  };
}

function getRelationEntityLabel(
  entityType: string,
  entityId: number,
  names: {
    characterNameMap: Map<number, string>;
    factionNameMap: Map<number, string>;
    itemNameMap: Map<number, string>;
    hookNameMap: Map<number, string>;
    worldSettingNameMap: Map<number, string>;
  },
) {
  if (entityType === "character") {
    return names.characterNameMap.get(entityId) ?? `角色#${entityId}`;
  }
  if (entityType === "faction") {
    return names.factionNameMap.get(entityId) ?? `势力#${entityId}`;
  }
  if (entityType === "item") {
    return names.itemNameMap.get(entityId) ?? `物品#${entityId}`;
  }
  if (entityType === "hook") {
    return names.hookNameMap.get(entityId) ?? `钩子#${entityId}`;
  }
  return names.worldSettingNameMap.get(entityId) ?? `世界设定#${entityId}`;
}

function ResourceSelectionGroup(props: {
  title: string;
  options: ResourceOption[];
  selectedIds: number[];
  onToggle: (resourceId: number) => void;
  onEdit?: (resourceId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const filteredOptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return props.options;
    }

    return props.options.filter((option) => {
      const haystacks = [option.name, option.subtitle ?? ""];
      return haystacks.some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, props.options]);

  const totalPages = Math.max(1, Math.ceil(filteredOptions.length / resourceSelectorPageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOptions = filteredOptions.slice(
    (currentPage - 1) * resourceSelectorPageSize,
    currentPage * resourceSelectorPageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  useEffect(() => {
    if (!expanded) {
      setKeyword("");
      setPage(1);
      return;
    }

    setPage((current) => Math.min(current, totalPages));
  }, [expanded, totalPages]);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="text-sm font-medium text-slate-900">{props.title}</div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            >
              展开
            </button>
          </div>
          <div className="text-xs text-slate-500">已选 {props.selectedIds.length}</div>
        </div>
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
          {props.options.length === 0 && <div className="text-xs text-slate-500">当前没有可选资源。</div>}
          {props.options.map((option) => {
            const checked = props.selectedIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={`block cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
                  checked ? "border-primary bg-primary/5 text-slate-950" : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => props.onToggle(option.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{option.name}</div>
                    {getResourceSubtitle(option)}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-20 sm:pt-24">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`resource-selector-dialog-title-${props.title}`}
            className="w-full max-w-5xl rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id={`resource-selector-dialog-title-${props.title}`} className="text-lg font-semibold text-slate-950">
                  {props.title}选择器
                </h3>
                <p className="mt-1 text-sm text-slate-500">支持名称模糊搜索、分页浏览与勾选同步。</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                  <label className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">按名称模糊搜索</div>
                    <input
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder={`搜索${props.title}名称`}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                  </label>
                  <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-500">
                    共 {filteredOptions.length} 条，已选 {props.selectedIds.length} 条
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                      <tr>
                        <th className="w-16 px-4 py-3">选择</th>
                        <th className="w-20 px-4 py-3">ID</th>
                        <th className="px-4 py-3">名称</th>
                        <th className="px-4 py-3">说明</th>
                        <th className="w-24 px-4 py-3">修改</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {pagedOptions.length > 0 ? (
                        pagedOptions.map((option) => {
                          const checked = props.selectedIds.includes(option.id);
                          return (
                            <tr key={option.id} className={checked ? "bg-primary/5" : ""}>
                              <td className="px-4 py-3 align-middle">
                                <input
                                  aria-label={`选择${option.name}`}
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => props.onToggle(option.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              </td>
                              <td className="px-4 py-3 align-middle text-slate-500">{option.id}</td>
                              <td className="px-4 py-3 align-middle font-medium text-slate-900">{option.name}</td>
                              <td className="px-4 py-3 align-middle text-slate-600">{option.subtitle || "—"}</td>
                              <td className="px-4 py-3 align-middle">
                                <button
                                  type="button"
                                  onClick={() => props.onEdit?.(option.id)}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                                  aria-label={`修改${option.name}`}
                                >
                                  修改
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                            没有匹配到资源。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div>
                    第 {currentPage} / {totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage <= 1}
                      className="rounded-2xl bg-white px-4 py-2 disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={currentPage >= totalPages}
                      className="rounded-2xl bg-white px-4 py-2 disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">已选摘要</div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  {props.selectedIds.length > 0 ? (
                    props.selectedIds.map((selectedId) => {
                      const selectedOption = props.options.find((option) => option.id === selectedId);
                      return (
                        <div key={selectedId} className="rounded-xl bg-white px-3 py-2">
                          <div className="font-medium text-slate-900">{selectedOption?.name ?? `#${selectedId}`}</div>
                          <div className="mt-1 text-slate-500">ID {selectedId}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-500">当前还没有已选资源。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ChapterWorkbenchPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bookId = parseBookId(params.bookId);
  const chapterNo = parseChapterNo(params.chapterNo);
  // safeBookId / safeChapterNo only meaningful when both bookId and chapterNo
  // are non-null; query/mutation closures are gated by enabled and the early
  // return at the bottom of this hook block.
  const safeBookId = bookId ?? 0;
  const safeChapterNo = chapterNo ?? 0;
  const workflowPreset = (location.state as ChapterWorkbenchLocationState | null) ?? null;
  const workflowPresetProvider = workflowPreset?.provider;
  const workflowPresetLowModel = workflowPreset?.lowModel;
  const workflowPresetMidModel = workflowPreset?.midModel;
  const workflowPresetHighModel = workflowPreset?.highModel;
  const userRuntimeSettingsQuery = useQuery({
    queryKey: queryKeys.userRuntimeSettings(),
    queryFn: () => getUserRuntimeSettings(),
  });
  const runtimeWorkflowDefaults = useMemo(
    () => ({
      provider: userRuntimeSettingsQuery.data?.effective.provider ?? "mock",
      lowModel: userRuntimeSettingsQuery.data?.effective.lowModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
      midModel: userRuntimeSettingsQuery.data?.effective.midModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
      highModel: userRuntimeSettingsQuery.data?.effective.highModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
    }),
    [userRuntimeSettingsQuery.data],
  );
  const initialWorkflowSettings = useMemo(
    () => loadStoredWorkflowSettings(safeBookId, safeChapterNo, workflowPreset, runtimeWorkflowDefaults),
    [bookId, chapterNo, workflowPresetProvider, workflowPresetLowModel, workflowPresetMidModel, workflowPresetHighModel, runtimeWorkflowDefaults],
  );
  const [activeTab, setActiveTab] = useState<StageTab>("plan");
  const [provider, setProvider] = useState<WorkflowProvider>(initialWorkflowSettings.provider);
  const [lowModel, setLowModel] = useState(initialWorkflowSettings.lowModel);
  const [midModel, setMidModel] = useState(initialWorkflowSettings.midModel);
  const [highModel, setHighModel] = useState(initialWorkflowSettings.highModel);
  const [targetWords, setTargetWords] = useState(initialWorkflowSettings.targetWords);
  const [workflowSettingsDialogOpen, setWorkflowSettingsDialogOpen] = useState(false);
  const [workflowSettingsDraft, setWorkflowSettingsDraft] = useState<StoredWorkflowSettings>({
    provider: initialWorkflowSettings.provider,
    lowModel: initialWorkflowSettings.lowModel,
    midModel: initialWorkflowSettings.midModel,
    highModel: initialWorkflowSettings.highModel,
    targetWords: initialWorkflowSettings.targetWords,
  });
  const [planIntentDialogMode, setPlanIntentDialogMode] = useState<"initial" | "replan" | null>(null);
  const [planIntentDraft, setPlanIntentDraft] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorSummary, setEditorSummary] = useState("");
  const previousActiveTabRef = useRef<StageTab>("plan");
  const lastHydratedStageRef = useRef<{ tab: StageTab; content: string; summary: string } | null>(null);
  const hydratedManualEntityRefsKeyRef = useRef<string | null>(null);
  // Synchronous guard against rapid double-clicks on workflow buttons. The
  // mutation's own isPending flips on the next render tick, which is too late
  // for back-to-back keypresses.
  const workflowSubmitLockRef = useRef(false);
  const [manualEntityRefs, setManualEntityRefs] = useState<ManualEntityRefs>(emptyManualEntityRefs);
  const [resourceEditor, setResourceEditor] = useState<ResourceEditorState | null>(null);
  const [resourceEditorForm, setResourceEditorForm] = useState<ResourceEditorFormState>({});
  const [historyLimit, setHistoryLimit] = useState<(typeof historyLimitOptions)[number]>(10);
  const [selectedHistoryIdByStage, setSelectedHistoryIdByStage] = useState<Partial<Record<ChapterStage, number>>>({});
  const [historyComparisonIdsByStage, setHistoryComparisonIdsByStage] = useState<Partial<Record<ChapterStage, number[]>>>({});
  const [selectedWorkflowTaskId, setSelectedWorkflowTaskId] = useState<number | null>(null);
  const [historyContentExpanded, setHistoryContentExpanded] = useState(false);
  const [historyDiffDialogOpen, setHistoryDiffDialogOpen] = useState(false);
  const [activeWorkflowTaskId, setActiveWorkflowTaskId] = useState<number | null>(null);
  const [activeWorkflowTaskType, setActiveWorkflowTaskType] = useState<WorkflowTaskType | null>(null);
  const [lastCompletedWorkflowTask, setLastCompletedWorkflowTask] = useState<WorkflowTaskView | null>(null);
  const lastWorkflowFeedbackKeyRef = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    kind: "idle",
    title: "等待操作",
    detail: "这里会显示 workflow 与阶段保存的最近动作。",
  });

  useEffect(() => {
    const nextSettings = loadStoredWorkflowSettings(safeBookId, safeChapterNo, workflowPreset, runtimeWorkflowDefaults);
    setProvider(nextSettings.provider);
    setLowModel(nextSettings.lowModel);
    setMidModel(nextSettings.midModel);
    setHighModel(nextSettings.highModel);
    setTargetWords(nextSettings.targetWords);
    setWorkflowSettingsDraft(nextSettings);
  }, [bookId, chapterNo, workflowPresetProvider, workflowPresetLowModel, workflowPresetMidModel, workflowPresetHighModel, runtimeWorkflowDefaults]);

  useEffect(() => {
    hydratedManualEntityRefsKeyRef.current = null;
    setManualEntityRefs(emptyManualEntityRefs);
    setActiveWorkflowTaskId(null);
    setActiveWorkflowTaskType(null);
    setLastCompletedWorkflowTask(null);
    setSelectedWorkflowTaskId(null);
    lastWorkflowFeedbackKeyRef.current = null;
    setFeedback({
      kind: "idle",
      title: "等待操作",
      detail: "这里会显示 workflow 与阶段保存的最近动作。",
    });
  }, [bookId, chapterNo]);

  useEffect(() => {
    if (bookId === null || chapterNo === null || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getWorkflowSettingsStorageKey(safeBookId, safeChapterNo),
      JSON.stringify({ provider, lowModel, midModel, highModel, targetWords }),
    );
  }, [bookId, chapterNo, highModel, lowModel, midModel, provider, targetWords]);

  const chapterQuery = useQuery({
    queryKey: queryKeys.chapter(safeBookId, safeChapterNo),
    queryFn: () => getChapter(safeBookId, safeChapterNo),
    enabled: bookId !== null && chapterNo !== null,
  });

  const chaptersQuery = useQuery({
    queryKey: queryKeys.chapters(safeBookId),
    queryFn: () => listChapters(safeBookId),
    enabled: bookId !== null,
  });

  const workflowStateQuery = useQuery({
    queryKey: queryKeys.chapterWorkflowState(safeBookId, safeChapterNo),
    queryFn: () => getChapterWorkflowState(safeBookId, safeChapterNo),
    enabled: bookId !== null && chapterNo !== null,
  });

  const latestAuthorIntentTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "author_intent"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "author_intent"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const latestPlanTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "plan"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "plan"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const latestDraftTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "draft"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "draft"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const latestReviewTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "review"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "review"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const latestRepairTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "repair"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "repair"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const latestApproveTaskQuery = useQuery({
    queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "approve"),
    queryFn: () => getLatestChapterWorkflowTask(safeBookId, safeChapterNo, "approve"),
    enabled: bookId !== null && chapterNo !== null && activeWorkflowTaskId === null,
  });

  const workflowTaskQuery = useQuery({
    queryKey: queryKeys.workflowTask(activeWorkflowTaskId ?? "idle"),
    queryFn: () => getWorkflowTask(activeWorkflowTaskId as number),
    enabled: activeWorkflowTaskId !== null,
    refetchInterval: (query) => {
      const task = query.state.data as WorkflowTaskView | undefined;
      if (!task) {
        return 2000;
      }
      return task.status === "pending" || task.status === "running" || task.status === "terminating" ? 2000 : false;
    },
  });
  const workflowTaskHistoryQuery = useQuery({
    queryKey: queryKeys.chapterWorkflowTasks(safeBookId, safeChapterNo, 20),
    queryFn: () => listChapterWorkflowTasks(safeBookId, safeChapterNo, 20),
    enabled: bookId !== null && chapterNo !== null,
  });

  const stageAvailability = {
    plan: workflowStateQuery.data?.hasPlan ?? false,
    draft: workflowStateQuery.data?.hasDraft ?? false,
    review: workflowStateQuery.data?.hasReview ?? false,
    final: workflowStateQuery.data?.hasFinal ?? false,
  } satisfies Record<ChapterStage, boolean>;

  const workflowActionsAvailable = workflowStateQuery.data?.availableActions ?? [];

  const stageQueries = {
    plan: useQuery({
      queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "plan"),
      queryFn: () => getChapterStage(safeBookId, safeChapterNo, "plan"),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.plan,
    }),
    draft: useQuery({
      queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "draft"),
      queryFn: () => getChapterStage(safeBookId, safeChapterNo, "draft"),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.draft,
    }),
    review: useQuery({
      queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "review"),
      queryFn: () => getChapterStage(safeBookId, safeChapterNo, "review"),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.review,
    }),
    final: useQuery({
      queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "final"),
      queryFn: () => getChapterStage(safeBookId, safeChapterNo, "final"),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.final,
    }),
  };

  const historyQueries = {
    plan: useQuery({
      queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "plan", historyLimit),
      queryFn: () => listChapterStageHistory(safeBookId, safeChapterNo, "plan", historyLimit),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.plan,
    }),
    draft: useQuery({
      queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "draft", historyLimit),
      queryFn: () => listChapterStageHistory(safeBookId, safeChapterNo, "draft", historyLimit),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.draft,
    }),
    review: useQuery({
      queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "review", historyLimit),
      queryFn: () => listChapterStageHistory(safeBookId, safeChapterNo, "review", historyLimit),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.review,
    }),
    final: useQuery({
      queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "final", historyLimit),
      queryFn: () => listChapterStageHistory(safeBookId, safeChapterNo, "final", historyLimit),
      enabled: bookId !== null && chapterNo !== null && stageAvailability.final,
    }),
  };

  const charactersQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "characters"),
    queryFn: () => listCharacters(safeBookId),
    enabled: bookId !== null,
  });

  const factionsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "factions"),
    queryFn: () => listFactions(safeBookId),
    enabled: bookId !== null,
  });

  const itemsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "items"),
    queryFn: () => listItems(safeBookId),
    enabled: bookId !== null,
  });

  const hooksQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "hooks"),
    queryFn: () => listStoryHooks(safeBookId),
    enabled: bookId !== null,
  });

  const relationsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "relations"),
    queryFn: () => listRelations(safeBookId),
    enabled: bookId !== null,
  });

  const worldSettingsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "worldSettings"),
    queryFn: () => listWorldSettings(safeBookId),
    enabled: bookId !== null,
  });

  const activeStageKey = activeTab === "task" ? null : activeTab;
  const activeStageData = activeStageKey ? stageQueries[activeStageKey].data : null;
  const activeStageWordCount = activeStageData ? getStageWordCount(activeStageData.content) : null;
  const stageIsEditable = activeStageKey !== null && activeStageKey !== "review";
  const loadedSummary = activeStageData?.summary ?? "";
  const loadedContent = activeStageData?.content ?? "";
  const isDirty = stageIsEditable && (editorSummary !== loadedSummary || editorContent !== loadedContent);
  const availableActions = workflowActionsAvailable;
  const activeHistory = activeStageKey ? (historyQueries[activeStageKey].data ?? []) : [];
  const selectedHistoryId = activeStageKey ? selectedHistoryIdByStage[activeStageKey] : undefined;
  const selectedHistory = activeHistory.find((entry) => entry.id === selectedHistoryId) ?? activeHistory[0];
  const activeComparisonIds = activeStageKey ? (historyComparisonIdsByStage[activeStageKey] ?? []) : [];
  const comparisonEntries = activeComparisonIds
    .map((entryId) => activeHistory.find((entry) => entry.id === entryId))
    .filter((entry): entry is ChapterStageHistoryEntry => Boolean(entry))
    .sort((left, right) => activeHistory.findIndex((entry) => entry.id === left.id) - activeHistory.findIndex((entry) => entry.id === right.id));
  const comparisonCurrent = comparisonEntries[0];
  const comparisonPrevious = comparisonEntries[1];
  const comparisonDiffPreview = comparisonEntries.length === 2 ? getDiffPreview(comparisonCurrent, comparisonPrevious) : null;
  const workflowTaskHistory = workflowTaskHistoryQuery.data ?? [];
  const selectedWorkflowTask = workflowTaskHistory.find((task) => task.id === selectedWorkflowTaskId) ?? workflowTaskHistory[0] ?? null;
  const displayedWorkflowTask = workflowTaskQuery.data ?? lastCompletedWorkflowTask;
  const workflowStatusCard = getWorkflowStatusCardViewModel(displayedWorkflowTask, feedback);
  const taskDetailCard = getWorkflowStatusCardViewModel(selectedWorkflowTask, feedback);

  useEffect(() => {
    setHistoryContentExpanded(false);
  }, [activeTab, selectedHistory?.id, selectedWorkflowTask?.id]);

  useEffect(() => {
    const switchedTab = previousActiveTabRef.current !== activeTab;
    previousActiveTabRef.current = activeTab;

    if (!activeStageData) {
      lastHydratedStageRef.current = null;
      setEditorContent("");
      setEditorSummary("");
      return;
    }

    const nextStageState = {
      tab: activeTab,
      content: activeStageData.content,
      summary: activeStageData.summary ?? "",
    };
    const lastHydratedStage = lastHydratedStageRef.current;
    const firstLoadForStage =
      !lastHydratedStage ||
      lastHydratedStage.tab !== activeTab ||
      (lastHydratedStage.content === "" && lastHydratedStage.summary === "");

    if (!switchedTab && !firstLoadForStage && isDirty) {
      return;
    }

    lastHydratedStageRef.current = nextStageState;
    setEditorContent(nextStageState.content);
    setEditorSummary(nextStageState.summary);
  }, [activeStageData?.content, activeStageData?.summary, activeStageData?.metadata.updatedAt, activeTab, isDirty]);

  useEffect(() => {
    if (!activeStageKey) {
      return;
    }

    const firstEntry = activeHistory[0];
    if (!firstEntry) {
      return;
    }

    setSelectedHistoryIdByStage((current) => {
      if (current[activeStageKey]) {
        const stillExists = activeHistory.some((entry) => entry.id === current[activeStageKey]);
        if (stillExists) {
          return current;
        }
      }

      return {
        ...current,
        [activeStageKey]: firstEntry.id,
      };
    });
  }, [activeHistory, activeStageKey]);

  useEffect(() => {
    if (!activeStageKey) {
      setHistoryDiffDialogOpen(false);
      return;
    }

    setHistoryComparisonIdsByStage((current) => {
      const existing = current[activeStageKey] ?? [];
      if (existing.length === 0) {
        return current;
      }

      const filtered = existing.filter((entryId) => activeHistory.some((entry) => entry.id === entryId));
      if (filtered.length === existing.length) {
        return current;
      }

      return {
        ...current,
        [activeStageKey]: filtered,
      };
    });
  }, [activeHistory, activeStageKey]);

  useEffect(() => {
    if (comparisonEntries.length !== 2 && historyDiffDialogOpen) {
      setHistoryDiffDialogOpen(false);
    }
  }, [comparisonEntries.length, historyDiffDialogOpen]);

  useEffect(() => {
    const firstTask = workflowTaskHistory[0] ?? null;
    if (!firstTask) {
      if (selectedWorkflowTaskId !== null) {
        setSelectedWorkflowTaskId(null);
      }
      return;
    }

    if (activeWorkflowTaskId !== null) {
      const runningTask = workflowTaskHistory.find((task) => task.id === activeWorkflowTaskId);
      if (runningTask && (runningTask.status === "pending" || runningTask.status === "running" || runningTask.status === "terminating")) {
        if (selectedWorkflowTaskId !== runningTask.id) {
          setSelectedWorkflowTaskId(runningTask.id);
        }
        return;
      }
    }

    if (selectedWorkflowTaskId) {
      const stillExists = workflowTaskHistory.some((task) => task.id === selectedWorkflowTaskId);
      if (stillExists) {
        return;
      }
    }

    setSelectedWorkflowTaskId(firstTask.id);
  }, [workflowTaskHistory, activeWorkflowTaskId, selectedWorkflowTaskId]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const chapterList = useMemo(
    () => [...(chaptersQuery.data ?? [])].sort((left, right) => left.chapter_no - right.chapter_no),
    [chaptersQuery.data],
  );
  const currentChapterIndex = chapterList.findIndex((chapter) => chapter.chapter_no === chapterNo);
  const previousChapter = currentChapterIndex > 0 ? chapterList[currentChapterIndex - 1] ?? null : null;
  const nextChapter = currentChapterIndex >= 0 ? chapterList[currentChapterIndex + 1] ?? null : null;

  const characterOptions = useMemo<ResourceOption[]>(
    () =>
      (charactersQuery.data ?? []).map((character: CharacterView) => ({
        id: character.id,
        name: character.name,
        subtitle: character.status,
      })),
    [charactersQuery.data],
  );

  const factionOptions = useMemo<ResourceOption[]>(
    () =>
      (factionsQuery.data ?? []).map((faction: FactionView) => ({
        id: faction.id,
        name: faction.name,
        subtitle: faction.category ?? faction.status,
      })),
    [factionsQuery.data],
  );

  const itemOptions = useMemo<ResourceOption[]>(
    () =>
      (itemsQuery.data ?? []).map((item: ItemView) => ({
        id: item.id,
        name: item.name,
        subtitle: item.category ?? item.status,
      })),
    [itemsQuery.data],
  );

  const hookOptions = useMemo<ResourceOption[]>(
    () =>
      (hooksQuery.data ?? []).map((hook: StoryHookView) => ({
        id: hook.id,
        name: hook.title,
        subtitle: hook.status,
      })),
    [hooksQuery.data],
  );

  const worldSettingOptions = useMemo<ResourceOption[]>(
    () =>
      (worldSettingsQuery.data ?? []).map((worldSetting: WorldSettingView) => ({
        id: worldSetting.id,
        name: worldSetting.title,
        subtitle: worldSetting.category,
      })),
    [worldSettingsQuery.data],
  );

  const characterNameMap = useMemo(
    () => new Map((charactersQuery.data ?? []).map((item) => [item.id, item.name])),
    [charactersQuery.data],
  );
  const factionNameMap = useMemo(
    () => new Map((factionsQuery.data ?? []).map((item) => [item.id, item.name])),
    [factionsQuery.data],
  );
  const itemNameMap = useMemo(() => new Map((itemsQuery.data ?? []).map((item) => [item.id, item.name])), [itemsQuery.data]);
  const hookNameMap = useMemo(() => new Map((hooksQuery.data ?? []).map((item) => [item.id, item.title])), [hooksQuery.data]);
  const worldSettingNameMap = useMemo(
    () => new Map((worldSettingsQuery.data ?? []).map((item) => [item.id, item.title])),
    [worldSettingsQuery.data],
  );
  const relationOptions = useMemo<ResourceOption[]>(
    () =>
      (relationsQuery.data ?? []).map((relation: RelationView) => ({
        id: relation.id,
        name: `${relation.source_type}:${relation.source_id} → ${relation.target_type}:${relation.target_id}`,
        subtitle: `${getRelationEntityLabel(relation.source_type, relation.source_id, {
          characterNameMap,
          factionNameMap,
          itemNameMap,
          hookNameMap,
          worldSettingNameMap,
        })} → ${getRelationEntityLabel(relation.target_type, relation.target_id, {
          characterNameMap,
          factionNameMap,
          itemNameMap,
          hookNameMap,
          worldSettingNameMap,
        })}`,
      })),
    [relationsQuery.data, characterNameMap, factionNameMap, itemNameMap, hookNameMap, worldSettingNameMap],
  );
  const pickerSources: PickerSources = useMemo(
    () => ({
      characters: charactersQuery.data ?? [],
      factions: factionsQuery.data ?? [],
      items: itemsQuery.data ?? [],
      hooks: hooksQuery.data ?? [],
      worldSettings: worldSettingsQuery.data ?? [],
    }),
    [charactersQuery.data, factionsQuery.data, itemsQuery.data, hooksQuery.data, worldSettingsQuery.data],
  );
  const editableResourceMap = useMemo(() => ({
    characters: new Map((charactersQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
    factions: new Map((factionsQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
    items: new Map((itemsQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
    hooks: new Map((hooksQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
    relations: new Map((relationsQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
    worldSettings: new Map((worldSettingsQuery.data ?? []).map((item) => [item.id, item as EditableResourceRecord])),
  }), [charactersQuery.data, factionsQuery.data, itemsQuery.data, hooksQuery.data, relationsQuery.data, worldSettingsQuery.data]);

  useEffect(() => {
    if (!chapterQuery.data) {
      return;
    }

    const hydrateKey = `${bookId}:${chapterNo}`;
    if (hydratedManualEntityRefsKeyRef.current === hydrateKey) {
      return;
    }

    hydratedManualEntityRefsKeyRef.current = hydrateKey;
    setManualEntityRefs({
      characterIds: parseIdList(chapterQuery.data.actual_character_ids ?? null),
      factionIds: parseIdList(chapterQuery.data.actual_faction_ids ?? null),
      itemIds: parseIdList(chapterQuery.data.actual_item_ids ?? null),
      hookIds: parseIdList(chapterQuery.data.actual_hook_ids ?? null),
      relationIds: [],
      worldSettingIds: parseIdList(chapterQuery.data.actual_world_setting_ids ?? null),
    });
  }, [bookId, chapterNo, chapterQuery.data]);

  const refreshChapter = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.chapter(safeBookId, safeChapterNo) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterWorkflowState(safeBookId, safeChapterNo) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "plan") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "draft") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "review") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStage(safeBookId, safeChapterNo, "final") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "plan") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "draft") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "review") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterStageHistory(safeBookId, safeChapterNo, "final") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "author_intent") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "plan") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "review") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "repair") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "approve") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapterWorkflowTasks(safeBookId, safeChapterNo, 20) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapters(safeBookId) }),
    ]);
  }, [queryClient, safeBookId, safeChapterNo]);

  const refreshResourceQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "characters") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "factions") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "items") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "hooks") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "relations") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "worldSettings") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "characters", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "factions", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "items", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "hooks", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "worldSettings", { mode: "picker" }) }),
    ]);
  }, [queryClient, safeBookId]);

  useEffect(() => {
    if (activeWorkflowTaskId !== null) {
      return;
    }

    const candidates = [
      latestApproveTaskQuery.data,
      latestRepairTaskQuery.data,
      latestReviewTaskQuery.data,
      latestDraftTaskQuery.data,
      latestPlanTaskQuery.data,
      latestAuthorIntentTaskQuery.data,
    ].filter(Boolean) as WorkflowTaskView[];
    const runningTask = candidates.find((task) => task.status === "pending" || task.status === "running" || task.status === "terminating");
    if (!runningTask) {
      return;
    }

    // Don't re-adopt a "running" task that hasn't reported progress in 10+ minutes.
    // Workers can crash and leave the task in a permanent running state; auto-polling
    // such ghosts wastes requests and confuses the user.
    const updatedAtMs = new Date(runningTask.updatedAt).getTime();
    if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > 10 * 60 * 1000) {
      setFeedback({
        kind: "error",
        title: "检测到陈旧 workflow 任务",
        detail: `任务 #${runningTask.id} 上次更新已超过 10 分钟，请手动重启对应阶段。`,
      });
      return;
    }

    setActiveWorkflowTaskId(runningTask.id);
    setActiveWorkflowTaskType(runningTask.workflowType);
  }, [
    activeWorkflowTaskId,
    latestApproveTaskQuery.data,
    latestRepairTaskQuery.data,
    latestReviewTaskQuery.data,
    latestDraftTaskQuery.data,
    latestPlanTaskQuery.data,
    latestAuthorIntentTaskQuery.data,
  ]);

  useEffect(() => {
    const task = workflowTaskQuery.data;
    if (!task) {
      return;
    }

    // Drop stale poll results from a previously-active chapter — happens when
    // the user navigates between chapters while a task is still in flight.
    if (task.bookId !== safeBookId || task.chapterNo !== safeChapterNo) {
      return;
    }

    if (task.status === "pending" || task.status === "running" || task.status === "terminating") {
      const feedbackKey = `${task.status}:${task.workflowType}:${task.stage ?? "queued"}:${task.progressPercent ?? "null"}`;
      if (lastWorkflowFeedbackKeyRef.current === feedbackKey) {
        return;
      }
      lastWorkflowFeedbackKeyRef.current = feedbackKey;
      setFeedback({
        kind: "running",
        title: task.status === "terminating" ? `${task.workflowType} 正在终止` : `正在执行 ${task.workflowType}`,
        detail:
          task.status === "terminating"
            ? `终止请求已提交，当前阶段：${task.stage ?? "queued"}${task.progressPercent != null ? ` · ${task.progressPercent}%` : ""}`
            : `当前阶段：${task.stage ?? "queued"}${task.progressPercent != null ? ` · ${task.progressPercent}%` : ""}`,
      });
      return;
    }

    lastWorkflowFeedbackKeyRef.current = null;
    setLastCompletedWorkflowTask(task);

    if (task.status === "succeeded") {
      if (task.workflowType === "author_intent") {
        const result = task.result as { authorIntent?: string } | null;
        if (typeof result?.authorIntent === "string") {
          setPlanIntentDraft(result.authorIntent);
        }
        void workflowTaskHistoryQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "author_intent") });
        setFeedback({
          kind: "success",
          title: "authorIntent 生成完成",
          detail: "已将生成结果回填到输入框，可继续修改后再确认。",
        });
        setActiveWorkflowTaskId(null);
        setActiveWorkflowTaskType(null);
        return;
      }

      void refreshChapter();
      if (task.workflowType === "plan") {
        setActiveTab("plan");
      }
      if (task.workflowType === "draft") {
        setActiveTab("draft");
      }
      if (task.workflowType === "review") {
        setActiveTab("review");
      }
      if (task.workflowType === "repair") {
        setActiveTab("draft");
      }
      if (task.workflowType === "approve") {
        setActiveTab("final");
      }
      setFeedback({
        kind: "success",
        title: `${task.workflowType} 执行完成`,
        detail: "章节状态与阶段内容已刷新。",
      });
      setActiveWorkflowTaskId(null);
      setActiveWorkflowTaskType(null);
      return;
    }

    setFeedback({
      kind: task.status === "terminated" ? "idle" : "error",
      title: task.status === "terminated" ? `${task.workflowType} 已终止` : `${task.workflowType} 执行失败`,
      detail: task.error?.message ?? (task.status === "terminated" ? "任务已按请求停止。" : "Workflow 执行失败"),
    });
    void refreshChapter();
    setActiveWorkflowTaskId(null);
    setActiveWorkflowTaskType(null);
  }, [workflowTaskQuery.data, safeBookId, safeChapterNo, refreshChapter]);


  const saveStageMutation = useMutation({
    mutationFn: async () => {
      if (!stageIsEditable || !activeStageKey) {
        return null;
      }

      return updateChapterStage(safeBookId, safeChapterNo, activeStageKey, {
        content: editorContent,
        summary: editorSummary || null,
      });
    },
    onMutate: () => {
      setFeedback({
        kind: "running",
        title: `正在保存 ${activeStageKey ?? activeTab}`,
        detail: "保存会创建新版本并刷新 current pointer。",
      });
    },
    onSuccess: async () => {
      await refreshChapter();
      setFeedback({
        kind: "success",
        title: `${activeStageKey ?? activeTab} 保存成功`,
        detail: "最新内容已落库并刷新到当前章节状态。",
      });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        title: `${activeStageKey ?? activeTab} 保存失败`,
        detail: formatApiErrorMessage(error, "阶段保存失败"),
      });
    },
  });

  const terminateWorkflowTaskMutation = useMutation({
    mutationFn: async (taskId: number) => terminateWorkflowTask(taskId),
    onMutate: () => {
      setFeedback({
        kind: "running",
        title: "正在请求终止任务",
        detail: "任务会在当前步骤安全结束后停止。",
      });
    },
    onSuccess: async (task) => {
      setActiveWorkflowTaskId(task.status === "terminated" ? null : task.id);
      setActiveWorkflowTaskType(task.status === "terminated" ? null : task.workflowType);
      setLastCompletedWorkflowTask((current) => (task.status === "terminated" ? task : current));
      await Promise.all([
        workflowTaskHistoryQuery.refetch(),
        ...(activeWorkflowTaskId !== null ? [workflowTaskQuery.refetch()] : []),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "author_intent") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "plan") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "draft") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "review") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "repair") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.latestChapterWorkflowTask(safeBookId, safeChapterNo, "approve") }),
      ]);
      setFeedback({
        kind: task.status === "terminated" ? "idle" : "running",
        title: task.status === "terminated" ? "任务已终止" : "已请求终止任务",
        detail: task.status === "terminated" ? "任务已停止。" : "任务会在当前步骤结束后尽快停止。",
      });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        title: "终止任务失败",
        detail: formatApiErrorMessage(error, "终止任务失败"),
      });
    },
  });

  const workflowMutation = useMutation({
    mutationFn: async ({ action, dryRun, authorIntentOverride }: WorkflowRunRequest) => {
      const base = {
        bookId: safeBookId,
        chapterNo: safeChapterNo,
        provider,
        lowModel: lowModel || undefined,
        midModel: midModel || undefined,
        highModel: highModel || undefined,
      };

      if (action === "plan") {
        return startPlanTask({
          ...base,
          authorIntent: authorIntentOverride,
          targetWords: Number(targetWords) || undefined,
          manualEntityRefs,
        });
      }
      if (action === "draft") {
        return startDraftTask({
          ...base,
          targetWords: Number(targetWords) || undefined,
        });
      }
      if (action === "review") {
        return startReviewTask(base);
      }
      if (action === "repair") {
        return startRepairTask(base);
      }
      if (dryRun) {
        return runApprove({ ...base, dryRun });
      }
      return startApproveTask({ ...base, dryRun });
    },
    onMutate: ({ action, dryRun }) => {
      setFeedback({
        kind: "running",
        title: dryRun ? `正在预演 ${action}` : `正在执行 ${action}`,
        detail: action === "plan" ? "会带上当前选中的 manualEntityRefs。" : "请等待 workflow 执行完成。",
      });
    },
    onSuccess: async (result, { action, dryRun }) => {
      if (action === "plan" || action === "draft" || action === "review" || action === "repair" || (action === "approve" && !dryRun)) {
        const task = result as WorkflowTaskView;
        setLastCompletedWorkflowTask(task);
        setActiveWorkflowTaskId(task.id);
        setActiveWorkflowTaskType(task.workflowType);
        setFeedback({
          kind: "running",
          title: `正在执行 ${task.workflowType}`,
          detail: `任务已创建，当前阶段：${task.stage ?? "queued"}`,
        });
        return;
      }

      await refreshChapter();
      if (action === "approve" && !dryRun) setActiveTab("final");
      setFeedback({
        kind: "success",
        title: dryRun ? `${action} 预演完成` : `${action} 执行完成`,
        detail: dryRun ? "预演完成，尚未正式提交。" : "章节生命周期与阶段内容已刷新。",
      });
    },
    onError: (error, { action, dryRun }) => {
      setFeedback({
        kind: "error",
        title: dryRun ? `${action} 预演失败` : `${action} 执行失败`,
        detail: formatApiErrorMessage(error, "Workflow 执行失败"),
      });
    },
    onSettled: () => {
      workflowSubmitLockRef.current = false;
    },
  });

  const tryStartWorkflow = (request: WorkflowRunRequest) => {
    if (workflowSubmitLockRef.current || workflowMutation.isPending || activeWorkflowTaskType !== null) {
      return;
    }
    workflowSubmitLockRef.current = true;
    workflowMutation.mutate(request);
  };

  const generateAuthorIntentMutation = useMutation({
    mutationFn: async () =>
      startAuthorIntentTask({
        bookId: safeBookId,
        chapterNo: safeChapterNo,
        provider,
        lowModel: lowModel || undefined,
        midModel: midModel || undefined,
        highModel: highModel || undefined,
        manualEntityRefs,
      }),
    onMutate: () => {
      setFeedback({
        kind: "running",
        title: "正在生成 authorIntent",
        detail: "任务已提交，请等待生成完成。",
      });
    },
    onSuccess: (task) => {
      setLastCompletedWorkflowTask(task);
      setActiveWorkflowTaskId(task.id);
      setActiveWorkflowTaskType(task.workflowType);
      setSelectedWorkflowTaskId(task.id);
      setFeedback({
        kind: "running",
        title: "正在生成 authorIntent",
        detail: `任务已创建，当前阶段：${task.stage ?? "queued"}`,
      });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        title: "authorIntent 生成失败",
        detail: formatApiErrorMessage(error, "生成 authorIntent 失败"),
      });
    },
  });

  const generateStageSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!stageIsEditable || !activeStageKey) {
        throw new Error("当前阶段不支持生成摘要。");
      }
      return generateStageSummary({
        bookId: safeBookId,
        chapterNo: safeChapterNo,
        stage: activeStageKey,
        content: editorContent,
        provider,
        lowModel: lowModel || undefined,
        midModel: midModel || undefined,
        highModel: highModel || undefined,
      });
    },
    onSuccess: (result) => {
      setEditorSummary(result.summary);
      setFeedback({
        kind: "success",
        title: "阶段摘要生成完成",
        detail: "已将生成结果回填到摘要输入框，保存后才会写入当前阶段版本。",
      });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        title: "阶段摘要生成失败",
        detail: formatApiErrorMessage(error, "生成阶段摘要失败"),
      });
    },
  });

  const resourceEditorValidationMessage = resourceEditor
    ? getResourceFormValidationMessage(resourceEditor.resourceType, resourceEditorForm)
    : null;
  const resourceEditorPrimaryFieldValue = resourceEditor
    ? getResourcePrimaryFieldValue(resourceEditor.resourceType, resourceEditorForm)
    : "";

  const saveResourceMutation = useMutation({
    mutationFn: async () => {
      if (!resourceEditor) {
        throw new Error("当前没有可编辑的资源。");
      }

      const validationMessage = getResourceFormValidationMessage(resourceEditor.resourceType, resourceEditorForm);
      if (validationMessage) {
        throw new Error(validationMessage);
      }

      const payload = buildResourceSavePayload(resourceEditor.resourceType, resourceEditorForm);
      return saveResourceRecord(safeBookId, resourceEditor.resourceType, payload, resourceEditor.resourceId);
    },
    onSuccess: async () => {
      await refreshResourceQueries();
      setResourceEditor(null);
      setFeedback({
        kind: "success",
        title: "资源保存成功",
        detail: "实体信息已更新，当前选择器列表已同步刷新。",
      });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        title: "资源保存失败",
        detail: formatApiErrorMessage(error, "资源保存失败"),
      });
    },
  });

  useEffect(() => {
    if (activeTab !== "task") {
      return;
    }

    void workflowTaskHistoryQuery.refetch();
    if (activeWorkflowTaskId !== null) {
      void workflowTaskQuery.refetch();
    }
  }, [activeTab, activeWorkflowTaskId]);

  const switchTab = (nextTab: StageTab) => {
    if (nextTab === activeTab) {
      return;
    }

    if (isDirty && !window.confirm("当前阶段内容尚未保存，确定切换标签吗？")) {
      return;
    }

    setActiveTab(nextTab);
  };

  const navigateToChapter = (targetChapterNo: number | null | undefined) => {
    if (!targetChapterNo) {
      return;
    }

    if (isDirty && !window.confirm("当前阶段内容尚未保存，确定切换到其他章节吗？")) {
      return;
    }

    navigate(chapterWorkbenchPath(safeBookId, targetChapterNo));
  };

  const toggleManualRef = (key: keyof ManualEntityRefs, resourceId: number) => {
    setManualEntityRefs((current) => ({
      ...current,
      [key]: current[key].includes(resourceId)
        ? current[key].filter((id) => id !== resourceId)
        : [...current[key], resourceId],
    }));
  };

  const toggleHistoryComparison = (entryId: number) => {
    if (!activeStageKey) {
      return;
    }

    setHistoryComparisonIdsByStage((current) => {
      const existing = current[activeStageKey] ?? [];
      const isSelected = existing.includes(entryId);

      if (isSelected) {
        setHistoryDiffDialogOpen(false);
        return {
          ...current,
          [activeStageKey]: existing.filter((id) => id !== entryId),
        };
      }

      if (existing.length >= 2) {
        return current;
      }

      return {
        ...current,
        [activeStageKey]: [...existing, entryId],
      };
    });
  };

  const clearHistoryComparison = () => {
    if (!activeStageKey) {
      return;
    }

    setHistoryDiffDialogOpen(false);
    setHistoryComparisonIdsByStage((current) => ({
      ...current,
      [activeStageKey]: [],
    }));
  };

  const openHistoryDiffDialog = () => {
    if (comparisonEntries.length !== 2) {
      return;
    }
    setHistoryDiffDialogOpen(true);
  };

  const closeHistoryDiffDialog = () => {
    setHistoryDiffDialogOpen(false);
  };

  const openResourceEditor = (resourceType: EditableResourceKey, resourceId: number) => {
    const resource = editableResourceMap[resourceType].get(resourceId);
    if (!resource) {
      setFeedback({
        kind: "error",
        title: "资源加载失败",
        detail: "没有找到要编辑的实体，请稍后重试。",
      });
      return;
    }

    setResourceEditor({ resourceType, resourceId });
    setResourceEditorForm(buildResourceFormFromItem(resourceType, resource));
  };

  const closeResourceEditor = () => {
    setResourceEditor(null);
  };

  const openWorkflowSettingsDialog = () => {
    setWorkflowSettingsDraft({
      provider,
      lowModel,
      midModel,
      highModel,
      targetWords,
    });
    setWorkflowSettingsDialogOpen(true);
  };

  const closeWorkflowSettingsDialog = () => {
    setWorkflowSettingsDialogOpen(false);
    setWorkflowSettingsDraft({
      provider,
      lowModel,
      midModel,
      highModel,
      targetWords,
    });
  };

  const saveWorkflowSettings = () => {
    setProvider(workflowSettingsDraft.provider);
    setLowModel(workflowSettingsDraft.lowModel);
    setMidModel(workflowSettingsDraft.midModel);
    setHighModel(workflowSettingsDraft.highModel);
    setTargetWords(workflowSettingsDraft.targetWords);
    setWorkflowSettingsDialogOpen(false);
  };

  const clearWorkflowModelOverrides = () => {
    const resetSettings = loadStoredWorkflowSettings(safeBookId, safeChapterNo, workflowPreset, runtimeWorkflowDefaults);
    const clearedSettings = {
      ...resetSettings,
      provider: runtimeWorkflowDefaults.provider,
      lowModel: runtimeWorkflowDefaults.lowModel,
      midModel: runtimeWorkflowDefaults.midModel,
      highModel: runtimeWorkflowDefaults.highModel,
    };

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getWorkflowSettingsStorageKey(safeBookId, safeChapterNo));
    }

    setProvider(clearedSettings.provider);
    setLowModel(clearedSettings.lowModel);
    setMidModel(clearedSettings.midModel);
    setHighModel(clearedSettings.highModel);
    setTargetWords(clearedSettings.targetWords);
    setWorkflowSettingsDraft(clearedSettings);
    setFeedback({
      kind: "success",
      title: "已清除章节模型覆盖",
      detail: "当前章节已回退到用户默认的 low / mid / high 模型设置。",
    });
  };

  const closePlanIntentDialog = () => {
    generateAuthorIntentMutation.reset();
    setPlanIntentDialogMode(null);
    setPlanIntentDraft("");
  };

  const openInitialPlanDialog = () => {
    generateAuthorIntentMutation.reset();
    setPlanIntentDraft("");
    setPlanIntentDialogMode("initial");
  };

  const rerunPlan = () => {
    if (isDirty && !window.confirm("当前 plan 尚未保存，确定重新 plan 吗？")) {
      return;
    }

    generateAuthorIntentMutation.reset();
    setPlanIntentDraft("");
    setPlanIntentDialogMode("replan");
  };

  const confirmPlanIntent = () => {
    if (!planIntentDialogMode) {
      return;
    }
    if (workflowSubmitLockRef.current || workflowMutation.isPending || activeWorkflowTaskType !== null) {
      return;
    }
    workflowSubmitLockRef.current = true;
    workflowMutation.mutate({
      action: "plan",
      authorIntentOverride: planIntentDraft.trim() || undefined,
    });
    closePlanIntentDialog();
  };

  // Single source of truth for "any workflow is in flight"; used to disable
  // editor saves and AI summary alongside the workflow buttons themselves so
  // we don't write a stage on top of pointers a workflow is about to bump.
  const isAnyWorkflowBusy = activeWorkflowTaskType !== null || workflowMutation.isPending;
  const activeAuthorIntentTask = workflowTaskQuery.data && workflowTaskQuery.data.workflowType === "author_intent"
    ? workflowTaskQuery.data
    : activeWorkflowTaskType === "author_intent" && lastCompletedWorkflowTask?.workflowType === "author_intent"
      ? lastCompletedWorkflowTask
      : null;

  if (bookId === null || chapterNo === null) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
        URL 中的书籍编号或章节号无效，请回到对应书籍工作台重新进入。
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">章节与上下文</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-900">章节切换</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => navigateToChapter(previousChapter?.chapter_no)}
                disabled={!previousChapter}
                className="rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                {previousChapter ? `上一章 · ${previousChapter.chapter_no}` : "没有上一章"}
              </button>
              <button
                onClick={() => navigateToChapter(nextChapter?.chapter_no)}
                disabled={!nextChapter}
                className="rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                {nextChapter ? `下一章 · ${nextChapter.chapter_no}` : "没有下一章"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="font-medium text-slate-900">
              第 {chapterNo} 章 {chapterQuery.data?.title ? `· ${chapterQuery.data.title}` : ""}
            </div>
            <div className="mt-2 text-xs text-slate-500">状态：{workflowStateQuery.data?.status ?? chapterQuery.data?.status ?? "加载中"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <span key={action} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">
                  {formatActionLabel(action)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-nowrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-950">Workflow 参数</div>
                <div className="mt-1 text-xs text-slate-500">
                  个人默认配置在设置页维护；这里的 provider、模型与目标字数只覆盖当前章节当前这次运行。
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-slate-500">Provider</div>
                <div className="mt-1 font-medium text-slate-950">{provider}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-slate-500">Low Model</div>
                <div className="mt-1 font-medium text-slate-950">{lowModel || "未设置"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-slate-500">Mid Model</div>
                <div className="mt-1 font-medium text-slate-950">{midModel || "未设置"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-slate-500">High Model</div>
                <div className="mt-1 font-medium text-slate-950">{highModel || "未设置"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-slate-500">Target Words</div>
                <div className="mt-1 font-medium text-slate-950">{targetWords || "未设置"}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={clearWorkflowModelOverrides}
                className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                清除模型覆盖
              </button>
              <button
                type="button"
                onClick={openWorkflowSettingsDialog}
                className="whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                修改
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">manualEntityRefs 选择器</div>
                <div className="mt-1 text-xs text-slate-500">进入章节时会默认勾选当前已关联资源；plan 检索会优先带上这里当前勾选的资源。</div>
              </div>
              <button
                onClick={() => setManualEntityRefs(emptyManualEntityRefs)}
                className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs text-slate-600"
              >
                清空
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <ResourceSelectionGroup
                title="角色"
                options={characterOptions}
                selectedIds={manualEntityRefs.characterIds}
                onToggle={(id) => toggleManualRef("characterIds", id)}
                onEdit={(id) => openResourceEditor("characters", id)}
              />
              <ResourceSelectionGroup
                title="势力"
                options={factionOptions}
                selectedIds={manualEntityRefs.factionIds}
                onToggle={(id) => toggleManualRef("factionIds", id)}
                onEdit={(id) => openResourceEditor("factions", id)}
              />
              <ResourceSelectionGroup
                title="物品"
                options={itemOptions}
                selectedIds={manualEntityRefs.itemIds}
                onToggle={(id) => toggleManualRef("itemIds", id)}
                onEdit={(id) => openResourceEditor("items", id)}
              />
              <ResourceSelectionGroup
                title="钩子"
                options={hookOptions}
                selectedIds={manualEntityRefs.hookIds}
                onToggle={(id) => toggleManualRef("hookIds", id)}
                onEdit={(id) => openResourceEditor("hooks", id)}
              />
              <ResourceSelectionGroup
                title="关系"
                options={relationOptions}
                selectedIds={manualEntityRefs.relationIds}
                onToggle={(id) => toggleManualRef("relationIds", id)}
                onEdit={(id) => openResourceEditor("relations", id)}
              />
              <ResourceSelectionGroup
                title="世界设定"
                options={worldSettingOptions}
                selectedIds={manualEntityRefs.worldSettingIds}
                onToggle={(id) => toggleManualRef("worldSettingIds", id)}
                onEdit={(id) => openResourceEditor("worldSettings", id)}
              />
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Stage 工作区</h2>
            <p className="mt-1 text-sm text-slate-500">围绕当前章节的 plan / draft / review / final 进行编辑、查看与保存。</p>
          </div>
          {isDirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">有未保存改动</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {stages.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`rounded-2xl px-4 py-3 text-center text-sm font-medium transition ${
                activeTab === tab.key ? "bg-primary text-primary-foreground shadow-glow" : "bg-slate-100 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeStageKey ? (
          <>
            <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-indigo-500">Stage Snapshot</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {activeStageData ? `${activeStageData.metadata.stage} 阶段信息` : "阶段信息"}
                  </div>
                </div>
                {activeStageData && (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                    {activeStageWordCount ?? "—"} 字
                  </span>
                )}
              </div>

              {stageQueries[activeStageKey].isLoading && <div className="mt-4 text-sm text-slate-500">正在加载当前阶段内容...</div>}
              {stageQueries[activeStageKey].isError && <div className="mt-4 text-sm text-amber-700">当前阶段还没有可读取内容，或接口返回了错误。</div>}
              {activeStageData && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                    <div className="text-xs text-slate-500">当前阶段</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{activeStageData.metadata.stage}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                    <div className="text-xs text-slate-500">当前字数</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{activeStageWordCount ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                    <div className="text-xs text-slate-500">最后更新</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">
                      {new Date(activeStageData.metadata.updatedAt ?? Date.now()).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-xs text-slate-500">阶段摘要（可选）</div>
                {stageIsEditable && (
                  <button
                    type="button"
                    onClick={() => generateStageSummaryMutation.mutate()}
                    disabled={generateStageSummaryMutation.isPending || !editorContent.trim() || isAnyWorkflowBusy}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 disabled:opacity-60"
                  >
                    {generateStageSummaryMutation.isPending ? "生成摘要中..." : "AI 生成摘要"}
                  </button>
                )}
              </div>
              <textarea
                value={editorSummary}
                onChange={(event) => setEditorSummary(event.target.value)}
                disabled={!stageIsEditable}
                placeholder="阶段摘要（可选）"
                className="min-h-24 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 disabled:bg-slate-100"
              />
            </div>
            <textarea
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              disabled={!stageIsEditable}
              placeholder="阶段正文内容"
              className="min-h-[420px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 outline-none ring-0 disabled:bg-slate-100"
            />

            <div className="flex flex-wrap items-start justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1 text-xs text-slate-500">
                <div>
                  {activeTab === "review"
                    ? "Review 阶段当前为只读；可直接从这里发起 repair 或 approve。"
                    : activeTab === "plan"
                      ? "保存可写回当前 plan；可直接从这里重新 plan，或基于当前 plan 发起 draft。"
                      : activeTab === "draft"
                        ? "保存可写回当前 draft；也可以直接基于当前 draft 发起 review。"
                        : "保存会创建新版本并更新 current pointer。"}
                </div>
                <div>右侧控制区已收拢到这里，便于在同一视线内完成编辑与执行。</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeTab === "plan" && availableActions.includes("plan") && (
                  <button
                    onClick={openInitialPlanDialog}
                    disabled={isAnyWorkflowBusy}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "plan" ? "生成 plan 中..." : activeWorkflowTaskType === "plan" ? "plan 执行中..." : "生成 plan"}
                  </button>
                )}
                {activeTab === "plan" && (
                  <button
                    onClick={() => tryStartWorkflow({ action: "draft" })}
                    disabled={!availableActions.includes("draft") || isAnyWorkflowBusy}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "draft" ? "生成 draft 中..." : activeWorkflowTaskType === "draft" ? "draft 执行中..." : "生成 draft"}
                  </button>
                )}
                {activeTab === "draft" && (
                  <button
                    onClick={() => tryStartWorkflow({ action: "review" })}
                    disabled={!availableActions.includes("review") || isAnyWorkflowBusy}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "review" ? "生成 review 中..." : activeWorkflowTaskType === "review" ? "review 执行中..." : "生成 review"}
                  </button>
                )}
                {activeTab === "review" && (
                  <button
                    onClick={() => tryStartWorkflow({ action: "repair" })}
                    disabled={!availableActions.includes("repair") || isAnyWorkflowBusy}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "repair" ? "生成 repair 中..." : activeWorkflowTaskType === "repair" ? "repair 执行中..." : "生成 repair"}
                  </button>
                )}
                {activeTab === "review" && (
                  <button
                    onClick={() => tryStartWorkflow({ action: "approve" })}
                    disabled={!availableActions.includes("approve") || isAnyWorkflowBusy}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "approve" && !workflowMutation.variables?.dryRun
                      ? "批准中..."
                      : activeWorkflowTaskType === "approve"
                        ? "approve 执行中..."
                        : "批准成稿"}
                  </button>
                )}
                {activeTab === "plan" && (
                  <button
                    onClick={rerunPlan}
                    disabled={isAnyWorkflowBusy}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                  >
                    {workflowMutation.isPending && workflowMutation.variables?.action === "plan" ? "重新 plan 中..." : activeWorkflowTaskType === "plan" ? "plan 执行中..." : "重新 plan"}
                  </button>
                )}
                {stageIsEditable && (
                  <button
                    onClick={() => saveStageMutation.mutate()}
                    disabled={saveStageMutation.isPending || !editorContent.trim() || isAnyWorkflowBusy}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {saveStageMutation.isPending ? "保存中..." : `保存 ${activeStageKey}`}
                  </button>
                )}
              </div>
            </div>

            <div
              className={`rounded-[24px] border p-5 shadow-sm ${
                workflowStatusCard.tone === "error"
                  ? "border-rose-100 bg-gradient-to-r from-rose-50 via-white to-rose-50 text-rose-700"
                  : workflowStatusCard.tone === "success"
                    ? "border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 text-emerald-700"
                    : workflowStatusCard.tone === "running"
                      ? "border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 text-indigo-700"
                      : "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 text-slate-600"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide opacity-80">{workflowStatusCard.eyebrow}</div>
                  <div className="mt-1 text-lg font-semibold">{workflowStatusCard.title}</div>
                  <div className="mt-1 text-sm opacity-90">{workflowStatusCard.detail}</div>
                </div>
                {workflowStatusCard.badge && (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium ring-1 ring-current/10">
                    {workflowStatusCard.badge}
                  </span>
                )}
              </div>
              {workflowStatusCard.progressPercent != null && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs opacity-80">
                    <span>任务进度</span>
                    <span>{workflowStatusCard.progressPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full bg-current transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, workflowStatusCard.progressPercent))}%` }}
                    />
                  </div>
                </div>
              )}
              {workflowStatusCard.meta.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs opacity-90">
                  {workflowStatusCard.meta.map((item) => (
                    <span key={item} className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-current/10">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">版本历史</h3>
                      <p className="mt-1 text-xs text-slate-500">按版本号倒序展示当前 stage 的最近版本，可切换查看详情或勾选两个版本进行差异对比。</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500" htmlFor="history-limit-select">
                        history limit
                      </label>
                      <select
                        id="history-limit-select"
                        value={historyLimit}
                        onChange={(event) => setHistoryLimit(Number(event.target.value) as (typeof historyLimitOptions)[number])}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                      >
                        {historyLimitOptions.map((limit) => (
                          <option key={limit} value={limit}>
                            {limit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {historyQueries[activeStageKey].isLoading && <div className="text-sm text-slate-500">正在加载版本历史...</div>}
                    {!historyQueries[activeStageKey].isLoading && activeHistory.length === 0 && (
                      <div className="text-sm text-slate-500">当前 stage 还没有历史版本。</div>
                    )}
                    {activeHistory.map((entry) => {
                      const isSelected = selectedHistory?.id === entry.id;
                      const isCompared = activeComparisonIds.includes(entry.id);
                      const comparisonDisabled = activeComparisonIds.length >= 2 && !isCompared;
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                            isSelected ? "border-primary bg-white shadow-sm" : "border-transparent bg-white text-slate-600"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedHistoryIdByStage((current) => ({
                                ...current,
                                [activeStageKey]: entry.id,
                              }))
                            }
                            className="block flex-1 text-left text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium text-slate-900">
                                v{entry.versionNo} {entry.isCurrent ? "· current" : ""}
                              </div>
                              <div className="text-xs text-slate-500">{new Date(entry.updatedAt).toLocaleString("zh-CN")}</div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">字数：{entry.wordCount ?? "—"}</div>
                            {entry.summary && <div className="mt-2 line-clamp-3 text-xs text-slate-600">{entry.summary}</div>}
                          </button>
                          <label className={`mt-1 flex shrink-0 items-center gap-2 text-xs ${comparisonDisabled ? "text-slate-300" : "text-slate-500"}`}>
                            <input
                              type="checkbox"
                              aria-label={`对比 v${entry.versionNo}`}
                              checked={isCompared}
                              disabled={comparisonDisabled}
                              onChange={() => toggleHistoryComparison(entry.id)}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                            />
                            <span>对比</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {activeComparisonIds.length > 0 && (
                    <div className="mt-4 rounded-[24px] border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 text-sm text-slate-600 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">Comparison</div>
                          <div className="mt-1 font-medium text-slate-900">
                            {comparisonEntries.length === 2
                              ? `已选择 v${comparisonPrevious?.versionNo} ↔ v${comparisonCurrent?.versionNo}`
                              : `已选择 v${comparisonEntries[0]?.versionNo ?? "—"}`}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {comparisonEntries.length === 2 ? "已可查看差异浮层。" : "再勾选一个版本即可比较。"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {comparisonEntries.length === 2 && (
                            <button
                              type="button"
                              onClick={openHistoryDiffDialog}
                              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white"
                            >
                              查看差异
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={clearHistoryComparison}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600"
                          >
                            清空比较
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedHistory && (
                    <div className="mt-4 rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-sky-500">Selected Version</div>
                          <div className="mt-1 text-lg font-semibold text-slate-950">v{selectedHistory.versionNo}</div>
                          <p className="mt-1 text-xs text-slate-500">
                            {selectedHistory.isCurrent ? "当前版本" : "历史版本"}
                            {" · "}
                            {selectedHistory.wordCount ?? "—"} 字
                            {" · "}
                            {new Date(selectedHistory.updatedAt).toLocaleString("zh-CN")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                          <div className="font-medium text-slate-900">summary</div>
                          <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap leading-6">{selectedHistory.summary || "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">full content</div>
                            <button
                              type="button"
                              onClick={() => setHistoryContentExpanded((current) => !current)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                            >
                              {historyContentExpanded ? "收起正文" : "展开正文"}
                            </button>
                          </div>
                          {historyContentExpanded && (
                            <div className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap leading-6">{selectedHistory.content || "—"}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Task 历史</h3>
                    <p className="mt-1 text-xs text-slate-500">按时间倒序展示当前章节的 workflow task，可切换查看进度与详情。</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {workflowTaskHistoryQuery.isLoading && <div className="text-sm text-slate-500">正在加载任务历史...</div>}
                  {!workflowTaskHistoryQuery.isLoading && workflowTaskHistory.length === 0 && (
                    <div className="text-sm text-slate-500">当前章节还没有 workflow task 记录。</div>
                  )}
                  {workflowTaskHistory.map((task) => {
                    const isSelected = selectedWorkflowTask?.id === task.id;
                    const statusLabel = getWorkflowTaskStatusLabel(task.status);
                    const stageLabel = getWorkflowTaskStageLabel(task.stage);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedWorkflowTaskId(task.id)}
                        className={`block w-full rounded-2xl border p-3 text-left text-sm transition ${
                          isSelected ? "border-primary bg-white shadow-sm" : "border-transparent bg-white text-slate-600"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">{getWorkflowTaskTypeLabel(task.workflowType)} · 任务 #{task.id}</div>
                          <div className="text-xs text-slate-500">{new Date(task.updatedAt).toLocaleString("zh-CN")}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{statusLabel}</span>
                          <span>·</span>
                          <span>{stageLabel}</span>
                          {task.progressPercent != null && (
                            <>
                              <span>·</span>
                              <span>{task.progressPercent}%</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className={`rounded-[24px] border p-5 shadow-sm ${
                  taskDetailCard.tone === "error"
                    ? "border-rose-100 bg-gradient-to-r from-rose-50 via-white to-rose-50 text-rose-700"
                    : taskDetailCard.tone === "success"
                      ? "border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 text-emerald-700"
                      : taskDetailCard.tone === "running"
                        ? "border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 text-indigo-700"
                        : "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 text-slate-600"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide opacity-80">{taskDetailCard.eyebrow}</div>
                    <div className="mt-1 text-lg font-semibold">{taskDetailCard.title}</div>
                    <div className="mt-1 text-sm opacity-90">{taskDetailCard.detail}</div>
                  </div>
                  {taskDetailCard.badge && (
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium ring-1 ring-current/10">
                      {taskDetailCard.badge}
                    </span>
                  )}
                </div>
                {taskDetailCard.progressPercent != null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs opacity-80">
                      <span>任务进度</span>
                      <span>{taskDetailCard.progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                      <div
                        className="h-full rounded-full bg-current transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, taskDetailCard.progressPercent))}%` }}
                      />
                    </div>
                  </div>
                )}
                {taskDetailCard.meta.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs opacity-90">
                    {taskDetailCard.meta.map((item) => (
                      <span key={item} className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-current/10">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selectedWorkflowTask && (
                <div className="rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-sky-500">Task Detail</div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">任务 #{selectedWorkflowTask.id}</h3>
                    </div>
                    {(selectedWorkflowTask.status === "pending" ||
                      selectedWorkflowTask.status === "running" ||
                      selectedWorkflowTask.status === "terminating") && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedWorkflowTask.status === "terminating") {
                            return;
                          }
                          if (!window.confirm("确定终止当前任务吗？任务会在当前步骤安全结束后停止。")) {
                            return;
                          }
                          terminateWorkflowTaskMutation.mutate(selectedWorkflowTask.id);
                        }}
                        disabled={selectedWorkflowTask.status === "terminating" || terminateWorkflowTaskMutation.isPending}
                        className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                      >
                        {selectedWorkflowTask.status === "terminating" ? "终止中..." : terminateWorkflowTaskMutation.isPending ? "提交中..." : "终止任务"}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">workflow type</div>
                      <div className="mt-2">{getWorkflowTaskTypeLabel(selectedWorkflowTask.workflowType)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">status / stage</div>
                      <div className="mt-2">{getWorkflowTaskStatusLabel(selectedWorkflowTask.status)} / {getWorkflowTaskStageLabel(selectedWorkflowTask.stage)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">started / finished</div>
                      <div className="mt-2 whitespace-pre-wrap">{selectedWorkflowTask.startedAt ? new Date(selectedWorkflowTask.startedAt).toLocaleString("zh-CN") : "—"}{"\n"}{selectedWorkflowTask.finishedAt ? new Date(selectedWorkflowTask.finishedAt).toLocaleString("zh-CN") : "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">plan / draft pointer</div>
                      <div className="mt-2">Plan #{selectedWorkflowTask.currentPlanId ?? "—"} · Draft #{selectedWorkflowTask.currentDraftId ?? "—"}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">result</div>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap leading-6">{formatTaskPayload(selectedWorkflowTask.result)}</pre>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">error</div>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap leading-6">{formatTaskPayload(selectedWorkflowTask.error)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {historyDiffDialogOpen && comparisonDiffPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-16 sm:pt-20">
          <div role="dialog" aria-modal="true" aria-labelledby="history-diff-dialog-title" className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="history-diff-dialog-title" className="text-lg font-semibold text-slate-950">版本差异对比</h3>
                <p className="mt-1 text-sm text-slate-500">围绕当前勾选的两个历史版本，快速判断新增与移除内容。</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  {comparisonDiffPreview.summary}
                </span>
                <button
                  type="button"
                  onClick={closeHistoryDiffDialog}
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-[24px] border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-rose-50 p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2 text-sm text-slate-600">
                <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">新增内容</div>
                  <div className="space-y-2">
                    {comparisonDiffPreview.addedLines.length > 0 ? (
                      comparisonDiffPreview.addedLines.map((line) => (
                        <div key={`add-${line}`} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-100">
                          + {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500">没有识别到新增段落。</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-rose-100">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-700">移除内容</div>
                  <div className="space-y-2">
                    {comparisonDiffPreview.removedLines.length > 0 ? (
                      comparisonDiffPreview.removedLines.map((line) => (
                        <div key={`remove-${line}`} className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                          - {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500">没有识别到移除段落。</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={clearHistoryComparison}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                清空比较
              </button>
              <button
                type="button"
                onClick={closeHistoryDiffDialog}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {resourceEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-16 sm:pt-20">
          <div role="dialog" aria-modal="true" aria-labelledby="resource-editor-dialog-title" className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="resource-editor-dialog-title" className="text-lg font-semibold text-slate-950">修改实体</h3>
                <p className="mt-1 text-sm text-slate-500">保存后会刷新当前选择器列表与已选摘要。</p>
              </div>
              <button
                type="button"
                onClick={closeResourceEditor}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-2xl bg-slate-50 p-4">
              <ResourceEditorForm
                resourceType={resourceEditor.resourceType}
                form={resourceEditorForm}
                setForm={setResourceEditorForm}
                pickerSources={pickerSources}
              />
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              {saveResourceMutation.isError
                ? formatApiErrorMessage(saveResourceMutation.error, "资源保存失败")
                : resourceEditorValidationMessage ?? "可以直接在这里快捷修改当前实体，无需离开章节工作台。"}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeResourceEditor}
                disabled={saveResourceMutation.isPending}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => saveResourceMutation.mutate()}
                disabled={saveResourceMutation.isPending || !resourceEditorPrimaryFieldValue.trim() || resourceEditorValidationMessage !== null}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saveResourceMutation.isPending ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {workflowSettingsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-28 sm:pt-32">
          <div role="dialog" aria-modal="true" aria-labelledby="workflow-settings-dialog-title" className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 id="workflow-settings-dialog-title" className="text-lg font-semibold text-slate-950">修改 workflow 参数</h3>
            <p className="mt-2 text-sm text-slate-500">
              个人默认值请前往
              <Link to={settingsPath()} className="mx-1 text-primary underline underline-offset-2">设置页</Link>
              维护。这里的修改仅覆盖当前章节当前这次 workflow 请求。
            </p>
            <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
              <label className="block text-xs text-slate-500">Provider</label>
              <select
                value={workflowSettingsDraft.provider}
                onChange={(event) =>
                  setWorkflowSettingsDraft((current) => ({
                    ...current,
                    provider: event.target.value as WorkflowProvider,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="mock">mock</option>
                <option value="openai">openai</option>
                <option value="anthropic">anthropic</option>
                <option value="custom">custom</option>
              </select>

              <label className="block text-xs text-slate-500">Low Model</label>
              <input
                value={workflowSettingsDraft.lowModel}
                onChange={(event) =>
                  setWorkflowSettingsDraft((current) => ({
                    ...current,
                    lowModel: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="可选 low 模型名"
              />

              <label className="block text-xs text-slate-500">Mid Model</label>
              <input
                value={workflowSettingsDraft.midModel}
                onChange={(event) =>
                  setWorkflowSettingsDraft((current) => ({
                    ...current,
                    midModel: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="可选 mid 模型名"
              />

              <label className="block text-xs text-slate-500">High Model</label>
              <input
                value={workflowSettingsDraft.highModel}
                onChange={(event) =>
                  setWorkflowSettingsDraft((current) => ({
                    ...current,
                    highModel: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="可选 high 模型名"
              />

              <label className="block text-xs text-slate-500">Target Words</label>
              <input
                value={workflowSettingsDraft.targetWords}
                onChange={(event) =>
                  setWorkflowSettingsDraft((current) => ({
                    ...current,
                    targetWords: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="3000"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeWorkflowSettingsDialog}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveWorkflowSettings}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              >
                保存参数
              </button>
            </div>
          </div>
        </div>
      )}

      {planIntentDialogMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-28 sm:pt-32">
          <div role="dialog" aria-modal="true" aria-labelledby="plan-intent-dialog-title" className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 id="plan-intent-dialog-title" className="text-lg font-semibold text-slate-950">
              {planIntentDialogMode === "initial" ? "生成 plan" : "重新 plan"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {planIntentDialogMode === "initial"
                ? "会基于当前 workflow 参数生成新的 plan，并带上当前 manualEntityRefs 勾选结果。你可以补充本次意图，也可以留空后直接确定。"
                : "会基于当前 workflow 参数重新生成新的 plan 版本，并带上当前 manualEntityRefs 勾选结果。你可以补充本次意图，也可以留空后直接确定。"}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">本次带入的 manualEntityRefs</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">角色 {manualEntityRefs.characterIds.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">势力 {manualEntityRefs.factionIds.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">物品 {manualEntityRefs.itemIds.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">钩子 {manualEntityRefs.hookIds.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">关系 {manualEntityRefs.relationIds.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">世界设定 {manualEntityRefs.worldSettingIds.length}</span>
              </div>
            </div>
            <label className="mt-4 block space-y-2 text-sm text-slate-600">
              <span>{planIntentDialogMode === "initial" ? "本次 plan 意图" : "本次重新 plan 意图"}</span>
              <textarea
                value={planIntentDraft}
                onChange={(event) => setPlanIntentDraft(event.target.value)}
                className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="可为空；留空时将不传 authorIntent。"
              />
            </label>
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => generateAuthorIntentMutation.mutate()}
                  disabled={generateAuthorIntentMutation.isPending || isAnyWorkflowBusy}
                  className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-60"
                >
                  {generateAuthorIntentMutation.isPending ? "提交中..." : activeAuthorIntentTask && (activeAuthorIntentTask.status === "pending" || activeAuthorIntentTask.status === "running" || activeAuthorIntentTask.status === "terminating") ? "生成 authorIntent 中..." : "生成 authorIntent"}
                </button>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={closePlanIntentDialog}
                    disabled={workflowMutation.isPending}
                    className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmPlanIntent}
                    disabled={workflowMutation.isPending}
                    className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    确定
                  </button>
                </div>
              </div>

              {activeAuthorIntentTask && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {getWorkflowTaskStatusLabel(activeAuthorIntentTask.status)} · {getWorkflowTaskStageLabel(activeAuthorIntentTask.stage)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        任务 #{activeAuthorIntentTask.id}
                        {activeAuthorIntentTask.progressPercent != null ? ` · ${activeAuthorIntentTask.progressPercent}%` : ""}
                      </div>
                    </div>
                    {(activeAuthorIntentTask.status === "pending" || activeAuthorIntentTask.status === "running" || activeAuthorIntentTask.status === "terminating") && (
                      <button
                        type="button"
                        onClick={() => terminateWorkflowTaskMutation.mutate(activeAuthorIntentTask.id)}
                        disabled={activeAuthorIntentTask.status === "terminating" || terminateWorkflowTaskMutation.isPending}
                        className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-60"
                      >
                        {activeAuthorIntentTask.status === "terminating" ? "终止中..." : terminateWorkflowTaskMutation.isPending ? "提交中..." : "终止任务"}
                      </button>
                    )}
                  </div>
                  {activeAuthorIntentTask.progressPercent != null && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${activeAuthorIntentTask.progressPercent}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
