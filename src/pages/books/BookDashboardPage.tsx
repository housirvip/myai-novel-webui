import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatApiErrorMessage } from "@/lib/api";
import { deleteBook, getBook, updateBook } from "@/lib/books-api";
import { createChapter, deleteChapter, listChapters, updateChapter } from "@/lib/chapters-api";
import { queryKeys } from "@/lib/query/query-keys";
import { bookReaderPath, chapterWorkbenchPath, parseBookId } from "@/lib/routes";
import { getUserRuntimeSettings } from "@/lib/user-settings-api";
import {
  listCharacters,
  listFactions,
  listItems,
  listStoryHooks,
  listWorldSettings,
} from "@/lib/resources-api";
import type { BookView, ChapterView, CreateChapterInput, UpdateChapterInput, WorkflowBaseInput } from "@/lib/types";
import { formatIdList, parseIdList } from "@/lib/utils";

const chapterStatuses = ["todo", "planned", "drafted", "reviewed", "repaired", "approved"] as const;
type WorkflowProvider = NonNullable<WorkflowBaseInput["provider"]>;
type ChapterCreateWorkflowProvider = WorkflowProvider | "default";

type ResourceOption = {
  id: number;
  name: string;
  subtitle?: string | null;
};

type ChapterEditForm = {
  title: string;
  summary: string;
  targetWordCount: string;
  status: string;
  actualCharacterIds: number[];
  actualFactionIds: number[];
  actualItemIds: number[];
  actualHookIds: number[];
  actualWorldSettingIds: number[];
};

type CreateChapterForm = {
  chapterNo: string;
  title: string;
  targetWordCount: string;
  status: string;
  provider: ChapterCreateWorkflowProvider;
  lowModel: string;
  midModel: string;
  highModel: string;
};

function formatStageState(chapter: Pick<ChapterView, "current_plan_id" | "current_draft_id" | "current_review_id" | "current_final_id">) {
  return [
    chapter.current_plan_id ? "Plan" : null,
    chapter.current_draft_id ? "Draft" : null,
    chapter.current_review_id ? "Review" : null,
    chapter.current_final_id ? "Final" : null,
  ].filter(Boolean);
}

function createDraftChapterForm(chapterNo?: number, defaults?: Partial<Pick<CreateChapterForm, "provider" | "lowModel" | "midModel" | "highModel">>): CreateChapterForm {
  return {
    chapterNo: chapterNo ? String(chapterNo) : "",
    title: "",
    targetWordCount: "",
    status: "todo",
    provider: defaults?.provider ?? "default",
    lowModel: defaults?.lowModel ?? "",
    midModel: defaults?.midModel ?? "",
    highModel: defaults?.highModel ?? "",
  };
}

function createBookForm(book?: BookView | null) {
  return {
    title: book?.title ?? "",
    summary: book?.summary ?? "",
    targetChapterCount: book?.target_chapter_count ? String(book.target_chapter_count) : "",
    status: book?.status ?? "drafting",
  };
}

function createEditChapterForm(chapter: ChapterView): ChapterEditForm {
  return {
    title: chapter.title ?? "",
    summary: chapter.summary ?? "",
    targetWordCount: chapter.target_word_count ? String(chapter.target_word_count) : "",
    status: chapter.status,
    actualCharacterIds: parseIdList(chapter.actual_character_ids),
    actualFactionIds: parseIdList(chapter.actual_faction_ids),
    actualItemIds: parseIdList(chapter.actual_item_ids),
    actualHookIds: parseIdList(chapter.actual_hook_ids),
    actualWorldSettingIds: parseIdList(chapter.actual_world_setting_ids),
  };
}

function ResourceSelectionGroup(props: {
  title: string;
  options: ResourceOption[];
  selectedIds: number[];
  onToggle: (resourceId: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-900">{props.title}</div>
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
                checked ? "border-primary bg-primary/5 text-slate-950" : "border-slate-200 bg-white text-slate-700"
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
                  {option.subtitle ? <div className="mt-1 text-[11px] text-slate-500">{option.subtitle}</div> : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function BookDashboardPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bookId = parseBookId(params.bookId);
  // safeBookId only meaningful when bookId !== null; query/mutation
  // closures are gated by the early return at the bottom of this hook block.
  const safeBookId = bookId ?? 0;

  const [bookForm, setBookForm] = useState(() => createBookForm());
  const [createForm, setCreateForm] = useState(() => createDraftChapterForm());
  const previousSuggestedChapterNoRef = useRef<number | null>(null);
  const lastHydratedCreateDefaultsRef = useRef<string | null>(null);
  const [editingChapterNo, setEditingChapterNo] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ChapterEditForm>({
    title: "",
    summary: "",
    targetWordCount: "",
    status: "todo",
    actualCharacterIds: [],
    actualFactionIds: [],
    actualItemIds: [],
    actualHookIds: [],
    actualWorldSettingIds: [],
  });

  const bookQuery = useQuery({
    queryKey: queryKeys.book(safeBookId),
    queryFn: () => getBook(safeBookId),
    enabled: bookId !== null,
  });

  const chaptersQuery = useQuery({
    queryKey: queryKeys.chapters(safeBookId),
    queryFn: () => listChapters(safeBookId),
    enabled: bookId !== null,
  });

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

  const worldSettingsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "worldSettings"),
    queryFn: () => listWorldSettings(safeBookId),
    enabled: bookId !== null,
  });
  const userRuntimeSettingsQuery = useQuery({
    queryKey: queryKeys.userRuntimeSettings(),
    queryFn: () => getUserRuntimeSettings(),
  });

  const book = bookQuery.data;
  const createFormDefaults = useMemo(
    () => ({
      provider: "default" as const,
      lowModel: userRuntimeSettingsQuery.data?.effective.lowModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
      midModel: userRuntimeSettingsQuery.data?.effective.midModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
      highModel: userRuntimeSettingsQuery.data?.effective.highModel ?? userRuntimeSettingsQuery.data?.effective.model ?? "",
    }),
    [userRuntimeSettingsQuery.data],
  );
  const chapters = useMemo(
    () => [...(chaptersQuery.data ?? [])].sort((left, right) => left.chapter_no - right.chapter_no),
    [chaptersQuery.data],
  );
  const nextChapterNo = useMemo(() => {
    if (!chaptersQuery.data) {
      return null;
    }
    const maxChapterNo = chapters.reduce((currentMax, chapter) => Math.max(currentMax, chapter.chapter_no), 0);
    return maxChapterNo + 1;
  }, [chapters, chaptersQuery.data]);

  useEffect(() => {
    setBookForm(createBookForm(book));
  }, [book?.id, book?.title, book?.summary, book?.target_chapter_count, book?.status]);

  useEffect(() => {
    if (nextChapterNo == null) {
      return;
    }

    setCreateForm((current) => {
      if (!current.chapterNo.trim() || current.chapterNo === String(previousSuggestedChapterNoRef.current)) {
        return {
          ...current,
          chapterNo: String(nextChapterNo),
        };
      }
      return current;
    });
    previousSuggestedChapterNoRef.current = nextChapterNo;
  }, [nextChapterNo]);

  useEffect(() => {
    const defaultsKey = JSON.stringify(createFormDefaults);
    if (lastHydratedCreateDefaultsRef.current === defaultsKey) {
      return;
    }

    setCreateForm((current) => {
      if (
        current.provider !== "default"
        || current.lowModel.trim().length > 0
        || current.midModel.trim().length > 0
        || current.highModel.trim().length > 0
      ) {
        return current;
      }

      return {
        ...current,
        provider: createFormDefaults.provider,
        lowModel: createFormDefaults.lowModel,
        midModel: createFormDefaults.midModel,
        highModel: createFormDefaults.highModel,
      };
    });
    lastHydratedCreateDefaultsRef.current = defaultsKey;
  }, [createFormDefaults]);

  const refreshBookContext = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.books() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.book(safeBookId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chapters(safeBookId) }),
    ]);
  };

  const createChapterMutation = useMutation({
    mutationFn: (input: CreateChapterInput) => createChapter(safeBookId, input),
    onSuccess: async (chapter) => {
      await refreshBookContext();
      navigate(chapterWorkbenchPath(safeBookId, chapter.chapter_no), {
        state: {
          provider: createForm.provider === "default" ? undefined : createForm.provider,
          lowModel: createForm.lowModel.trim() || undefined,
          midModel: createForm.midModel.trim() || undefined,
          highModel: createForm.highModel.trim() || undefined,
        },
      });
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: () =>
      updateBook(safeBookId, {
        title: bookForm.title.trim(),
        summary: bookForm.summary.trim() || undefined,
        targetChapterCount: bookForm.targetChapterCount ? Number(bookForm.targetChapterCount) : undefined,
        status: bookForm.status.trim() || undefined,
      }),
    onSuccess: async () => {
      await refreshBookContext();
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: () => deleteBook(safeBookId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.books() });
      navigate("/app");
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: ({ chapterNo, input }: { chapterNo: number; input: UpdateChapterInput }) =>
      updateChapter(safeBookId, chapterNo, input),
    onSuccess: async () => {
      await refreshBookContext();
      setEditingChapterNo(null);
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: (chapterNo: number) => deleteChapter(safeBookId, chapterNo),
    onSuccess: async () => {
      await refreshBookContext();
      setEditingChapterNo(null);
    },
  });

  const characterOptions = useMemo<ResourceOption[]>(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        id: character.id,
        name: character.name,
        subtitle: character.status,
      })),
    [charactersQuery.data],
  );

  const factionOptions = useMemo<ResourceOption[]>(
    () =>
      (factionsQuery.data ?? []).map((faction) => ({
        id: faction.id,
        name: faction.name,
        subtitle: faction.category ?? faction.status,
      })),
    [factionsQuery.data],
  );

  const itemOptions = useMemo<ResourceOption[]>(
    () =>
      (itemsQuery.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: item.category ?? item.status,
      })),
    [itemsQuery.data],
  );

  const hookOptions = useMemo<ResourceOption[]>(
    () =>
      (hooksQuery.data ?? []).map((hook) => ({
        id: hook.id,
        name: hook.title,
        subtitle: hook.status,
      })),
    [hooksQuery.data],
  );

  const worldSettingOptions = useMemo<ResourceOption[]>(
    () =>
      (worldSettingsQuery.data ?? []).map((worldSetting) => ({
        id: worldSetting.id,
        name: worldSetting.title,
        subtitle: worldSetting.category,
      })),
    [worldSettingsQuery.data],
  );

  const submitCreate = () => {
    const chapterNo = Number(createForm.chapterNo);
    if (!Number.isInteger(chapterNo) || chapterNo <= 0) {
      return;
    }

    createChapterMutation.mutate({
      chapterNo,
      title: createForm.title.trim() || null,
      targetWordCount: createForm.targetWordCount ? Number(createForm.targetWordCount) : null,
      status: createForm.status,
    });
  };

  const startEditChapter = (chapter: ChapterView) => {
    setEditingChapterNo(chapter.chapter_no);
    setEditForm(createEditChapterForm(chapter));
  };

  const toggleChapterResource = (key: keyof Pick<ChapterEditForm, "actualCharacterIds" | "actualFactionIds" | "actualItemIds" | "actualHookIds" | "actualWorldSettingIds">, resourceId: number) => {
    setEditForm((current) => ({
      ...current,
      [key]: current[key].includes(resourceId)
        ? current[key].filter((id) => id !== resourceId)
        : [...current[key], resourceId],
    }));
  };

  const submitEdit = () => {
    if (editingChapterNo === null) {
      return;
    }

    updateChapterMutation.mutate({
      chapterNo: editingChapterNo,
      input: {
        title: editForm.title.trim() || null,
        summary: editForm.summary.trim() || null,
        targetWordCount: editForm.targetWordCount ? Number(editForm.targetWordCount) : null,
        status: editForm.status,
        actualCharacterIds: formatIdList(editForm.actualCharacterIds),
        actualFactionIds: formatIdList(editForm.actualFactionIds),
        actualItemIds: formatIdList(editForm.actualItemIds),
        actualHookIds: formatIdList(editForm.actualHookIds),
        actualWorldSettingIds: formatIdList(editForm.actualWorldSettingIds),
      },
    });
  };

  const confirmDeleteBook = () => {
    if (!window.confirm(`确定删除《${book?.title ?? "当前书籍"}》吗？此操作不可撤销。`)) {
      return;
    }
    deleteBookMutation.mutate();
  };

  const confirmDeleteChapter = (chapterNo: number) => {
    if (!window.confirm(`确定删除第 ${chapterNo} 章吗？此操作不可撤销。`)) {
      return;
    }
    deleteChapterMutation.mutate(chapterNo);
  };

  if (bookId === null) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
        URL 中的书籍编号无效，请回到书籍总览重新进入。
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white">
        <p className="text-sm text-white/70">单书总控面板</p>
        <h2 className="mt-2 text-2xl font-semibold">{book?.title ?? "书籍工作台"}</h2>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="max-h-56 overflow-y-auto pr-1">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/78">
              {book?.summary || "这里会展示书籍信息、章节列表、资源概览与最近活跃章节。"}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">章节创建</h3>
                <p className="mt-1 text-sm text-slate-500">直接在 WebUI 内创建章节并进入对应工作台。</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm text-slate-600">
                <span>章节号</span>
                <input
                  value={createForm.chapterNo}
                  onChange={(event) => setCreateForm((current) => ({ ...current, chapterNo: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  inputMode="numeric"
                  placeholder="例如 12"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>目标字数</span>
                <input
                  value={createForm.targetWordCount}
                  onChange={(event) => setCreateForm((current) => ({ ...current, targetWordCount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  inputMode="numeric"
                  placeholder="例如 3000"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>Provider</span>
                <select
                  value={createForm.provider}
                  onChange={(event) => setCreateForm((current) => ({ ...current, provider: event.target.value as ChapterCreateWorkflowProvider }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                >
                  <option value="default">跟随个人默认</option>
                  <option value="mock">mock</option>
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="custom">custom</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>Low Model</span>
                <input
                  value={createForm.lowModel}
                  onChange={(event) => setCreateForm((current) => ({ ...current, lowModel: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  placeholder="留空则沿用个人默认"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>Mid Model</span>
                <input
                  value={createForm.midModel}
                  onChange={(event) => setCreateForm((current) => ({ ...current, midModel: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  placeholder="留空则沿用个人默认"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>High Model</span>
                <input
                  value={createForm.highModel}
                  onChange={(event) => setCreateForm((current) => ({ ...current, highModel: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  placeholder="留空则沿用个人默认"
                />
              </label>
              <label className="col-span-2 space-y-2 text-sm text-slate-600">
                <span>章节标题</span>
                <input
                  value={createForm.title}
                  onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  placeholder="例如：风雪夜归人"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500">建议下一章编号：第 {nextChapterNo ?? "—"} 章</div>
              <button
                onClick={submitCreate}
                disabled={createChapterMutation.isPending}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {createChapterMutation.isPending ? "创建中..." : "创建并进入工作台"}
              </button>
            </div>

            {createChapterMutation.isError && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formatApiErrorMessage(createChapterMutation.error, "创建章节失败")}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">章节列表</h3>
                <p className="mt-1 text-sm text-slate-500">按章节查看当前生命周期进度，并可直接进入编辑与阅读入口。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">共 {chapters.length} 章</span>
            </div>
            <div className="mt-4 space-y-3">
              {chaptersQuery.isLoading && <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">正在加载章节...</div>}
              {chapters.map((chapter) => {
                const stageBadges = formatStageState(chapter);
                const isEditing = chapter.chapter_no === editingChapterNo;
                return (
                  <div key={chapter.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-950">第 {chapter.chapter_no} 章</span>
                          {chapter.title && <span className="text-sm text-slate-700">· {chapter.title}</span>}
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">{chapter.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {stageBadges.length > 0 ? (
                            stageBadges.map((stage) => (
                              <span key={stage} className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                                {stage}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">暂无阶段产物</span>
                          )}
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-600">
                            更新于 {new Date(chapter.updated_at).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        {chapter.summary && <p className="max-w-3xl text-sm text-slate-600">{chapter.summary}</p>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={chapterWorkbenchPath(safeBookId, chapter.chapter_no)}
                          className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                        >
                          进入工作台
                        </Link>
                        <button
                          onClick={() => startEditChapter(chapter)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          <PencilLine className="h-4 w-4" />
                          编辑元信息
                        </button>
                        <button
                          onClick={() => confirmDeleteChapter(chapter.chapter_no)}
                          disabled={deleteChapterMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除章节
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                          <span>章节标题</span>
                          <input
                            value={editForm.title}
                            onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-slate-600">
                          <span>章节状态</span>
                          <select
                            value={editForm.status}
                            onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                          >
                            {chapterStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2 text-sm text-slate-600">
                          <span>目标字数</span>
                          <input
                            value={editForm.targetWordCount}
                            onChange={(event) => setEditForm((current) => ({ ...current, targetWordCount: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                            inputMode="numeric"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                          <span>章节摘要</span>
                          <textarea
                            value={editForm.summary}
                            onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))}
                            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                          />
                        </label>

                        <div className="space-y-3 md:col-span-2">
                          <div>
                            <h4 className="text-sm font-medium text-slate-900">章节实际关联资源</h4>
                            <p className="mt-1 text-xs text-slate-500">这些选择会写回 chapter 的 `actual_*` 字段，保持与现有 HTTP contract 一致。</p>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <ResourceSelectionGroup
                              title="角色"
                              options={characterOptions}
                              selectedIds={editForm.actualCharacterIds}
                              onToggle={(id) => toggleChapterResource("actualCharacterIds", id)}
                            />
                            <ResourceSelectionGroup
                              title="势力"
                              options={factionOptions}
                              selectedIds={editForm.actualFactionIds}
                              onToggle={(id) => toggleChapterResource("actualFactionIds", id)}
                            />
                            <ResourceSelectionGroup
                              title="物品"
                              options={itemOptions}
                              selectedIds={editForm.actualItemIds}
                              onToggle={(id) => toggleChapterResource("actualItemIds", id)}
                            />
                            <ResourceSelectionGroup
                              title="钩子"
                              options={hookOptions}
                              selectedIds={editForm.actualHookIds}
                              onToggle={(id) => toggleChapterResource("actualHookIds", id)}
                            />
                            <div className="xl:col-span-2">
                              <ResourceSelectionGroup
                                title="世界设定"
                                options={worldSettingOptions}
                                selectedIds={editForm.actualWorldSettingIds}
                                onToggle={(id) => toggleChapterResource("actualWorldSettingIds", id)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-slate-500">
                            {chapter.current_final_id ? "已产生成稿，可直接前往阅读页查看。" : "当前仍处于写作流程中。"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {chapter.current_final_id && (
                              <Link
                                to={bookReaderPath(safeBookId)}
                                className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700"
                              >
                                前往阅读页
                              </Link>
                            )}
                            <button
                              onClick={() => setEditingChapterNo(null)}
                              className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                            >
                              取消
                            </button>
                            <button
                              onClick={submitEdit}
                              disabled={updateChapterMutation.isPending}
                              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {updateChapterMutation.isPending ? "保存中..." : "保存章节信息"}
                            </button>
                          </div>
                        </div>
                        {(updateChapterMutation.isError || deleteChapterMutation.isError) && (
                          <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {updateChapterMutation.isError
                              ? formatApiErrorMessage(updateChapterMutation.error, "更新章节失败")
                              : formatApiErrorMessage(deleteChapterMutation.error, "删除章节失败")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!chaptersQuery.isLoading && chapters.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                  这本书还没有章节，直接使用上方表单即可创建第一章。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">书籍编辑</h3>
                <p className="mt-1 text-sm text-slate-500">直接修改标题、简介、目标章节数与当前状态。</p>
              </div>
              <button
                onClick={confirmDeleteBook}
                disabled={deleteBookMutation.isPending}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                删除书籍
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="space-y-2 text-sm text-slate-600">
                <span>书籍标题</span>
                <input
                  value={bookForm.title}
                  onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>书籍状态</span>
                <input
                  value={bookForm.status}
                  onChange={(event) => setBookForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  placeholder="例如 drafting / ongoing / completed"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>目标章节数</span>
                <input
                  value={bookForm.targetChapterCount}
                  onChange={(event) => setBookForm((current) => ({ ...current, targetChapterCount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                  inputMode="numeric"
                  placeholder="例如 100"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>书籍简介</span>
                <textarea
                  value={bookForm.summary}
                  onChange={(event) => setBookForm((current) => ({ ...current, summary: event.target.value }))}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary"
                />
              </label>
              <button
                onClick={() => updateBookMutation.mutate()}
                disabled={updateBookMutation.isPending || !bookForm.title.trim()}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {updateBookMutation.isPending ? "保存中..." : "保存书籍信息"}
              </button>
              {(updateBookMutation.isError || deleteBookMutation.isError) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {updateBookMutation.isError
                    ? formatApiErrorMessage(updateBookMutation.error, "更新书籍失败")
                    : formatApiErrorMessage(deleteBookMutation.error, "删除书籍失败")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">书籍概览</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">目标章节</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{book?.target_chapter_count ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">已批准</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{book?.current_chapter_count ?? 0}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">状态</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{book?.status ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">最近更新</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{book?.updated_at ? new Date(book.updated_at).toLocaleString("zh-CN") : "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
