import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { formatApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";
import { parseBookId } from "@/lib/routes";
import {
  createOutline,
  deleteCharacter,
  deleteFaction,
  deleteItem,
  deleteOutline,
  deleteRelation,
  deleteStoryHook,
  deleteWorldSetting,
  listCharacters,
  listFactions,
  listItems,
  listOutlines,
  listRelations,
  listStoryHooks,
  listWorldSettings,
  updateOutline,
} from "@/lib/resources-api";
import type {
  CharacterView,
  CreateOutlineInput,
  FactionView,
  ItemView,
  OutlineView,
  RelationView,
  StoryHookView,
  WorldSettingView,
} from "@/lib/types";
import { ResourceEditorForm } from "@/components/resources/ResourceEditorForm";
import {
  buildResourceFormFromItem,
  buildResourceSavePayload,
  getDefaultResourceForm,
  getEntityOptionsByType,
  getResourceFormValidationMessage,
  getResourcePrimaryFieldValue,
  relationTypes,
  saveResourceRecord,
  type EditableResourceKey,
  type EditableResourceRecord,
  type PickerSources,
  type ResourceEditorFormState,
} from "@/components/resources/resource-editor-shared";

type ResourceKey = "outlines" | EditableResourceKey;
type ResourceRecord = OutlineView | EditableResourceRecord;
type Option = { value: string; label: string };
type FormState = ResourceEditorFormState;

const resourceTabs: Array<{ key: ResourceKey; label: string; description: string }> = [
  { key: "outlines", label: "Outlines", description: "卷纲、章节范围与主支线。" },
  { key: "worldSettings", label: "World Settings", description: "世界规则、地理、制度与设定条目。" },
  { key: "characters", label: "Characters", description: "人物卡、状态、目标与能力备注。" },
  { key: "factions", label: "Factions", description: "势力、组织、领袖与核心目标。" },
  { key: "relations", label: "Relations", description: "角色与势力之间的关系边。" },
  { key: "items", label: "Items", description: "关键物品、归属与状态。" },
  { key: "hooks", label: "Hooks", description: "伏笔、触发章节与兑现目标。" },
];

const sortOptions = [
  { value: "updatedDesc", label: "最近更新" },
  { value: "createdDesc", label: "最新创建" },
  { value: "nameAsc", label: "名称 A-Z" },
] as const;

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOptionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function getStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  if (value === "active") {
    return "启用";
  }
  if (value === "inactive") {
    return "停用";
  }
  if (value === "open") {
    return "开放";
  }
  if (value === "closed") {
    return "关闭";
  }
  if (value === "alive") {
    return "存活";
  }
  if (value === "dead") {
    return "死亡";
  }
  return value;
}

function getDefaultForm(tab: ResourceKey): FormState {
  if (tab === "outlines") {
    return {
      title: "",
      outlineLevel: "main",
      volumeNo: "",
      volumeTitle: "",
      chapterStartNo: "",
      chapterEndNo: "",
      storyCore: "",
      mainPlot: "",
      subPlot: "",
      foreshadowing: "",
      expectedPayoff: "",
      notes: "",
    };
  }

  return getDefaultResourceForm(tab);
}

function buildFormFromItem(tab: ResourceKey, item: ResourceRecord): FormState {
  if (tab === "outlines") {
    const outline = item as OutlineView;
    return {
      title: outline.title,
      outlineLevel: outline.outline_level,
      volumeNo: outline.volume_no ? String(outline.volume_no) : "",
      volumeTitle: outline.volume_title ?? "",
      chapterStartNo: outline.chapter_start_no ? String(outline.chapter_start_no) : "",
      chapterEndNo: outline.chapter_end_no ? String(outline.chapter_end_no) : "",
      storyCore: outline.story_core ?? "",
      mainPlot: outline.main_plot ?? "",
      subPlot: outline.sub_plot ?? "",
      foreshadowing: outline.foreshadowing ?? "",
      expectedPayoff: outline.expected_payoff ?? "",
      notes: outline.notes ?? "",
    };
  }

  return buildResourceFormFromItem(tab, item as EditableResourceRecord);
}

function buildCreatePayload(_tab: ResourceKey, form: FormState): CreateOutlineInput {
  return {
    title: form.title.trim(),
    outlineLevel: form.outlineLevel.trim() || "main",
    volumeNo: toNullableNumber(form.volumeNo),
    volumeTitle: toNullableString(form.volumeTitle),
    chapterStartNo: toNullableNumber(form.chapterStartNo),
    chapterEndNo: toNullableNumber(form.chapterEndNo),
    storyCore: toNullableString(form.storyCore),
    mainPlot: toNullableString(form.mainPlot),
    subPlot: toNullableString(form.subPlot),
    foreshadowing: toNullableString(form.foreshadowing),
    expectedPayoff: toNullableString(form.expectedPayoff),
    notes: toNullableString(form.notes),
  };
}

function getOutlineFormValidationMessage(form: FormState) {
  if (!form.title.trim()) return "请先填写标题。";
  const start = toNullableNumber(form.chapterStartNo);
  const end = toNullableNumber(form.chapterEndNo);
  if ((start === null) !== (end === null)) {
    return "起止章节需要同时填写，或同时留空。";
  }
  if (start !== null && end !== null && start > end) {
    return "起始章节不能大于结束章节。";
  }
  return null;
}

function getOutlinePrimaryFieldValue(form: FormState) {
  return form.title;
}

function textInputClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary";
}

function textareaClass(minHeight = "min-h-28") {
  return `${minHeight} w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary`;
}

const outlineLevelOptions = [
  { value: "main", label: "主线大纲" },
  { value: "chapter_arc", label: "章节大纲" },
] as const;

function renderOutlineForm(form: FormState, setForm: React.Dispatch<React.SetStateAction<FormState>>) {
  return (
    <div className="space-y-3">
      <label className="block space-y-2 text-sm text-slate-600">
        <span>标题</span>
        <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={textInputClass()} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-2 text-sm text-slate-600">
          <span>大纲层级</span>
          <select value={form.outlineLevel} onChange={(event) => setForm((current) => ({ ...current, outlineLevel: event.target.value }))} className={textInputClass()}>
            {outlineLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block space-y-2 text-sm text-slate-600">
          <span>卷标题</span>
          <input value={form.volumeTitle} onChange={(event) => setForm((current) => ({ ...current, volumeTitle: event.target.value }))} className={textInputClass()} />
        </label>
        <label className="block space-y-2 text-sm text-slate-600">
          <span>卷号</span>
          <input value={form.volumeNo} onChange={(event) => setForm((current) => ({ ...current, volumeNo: event.target.value }))} className={textInputClass()} inputMode="numeric" />
        </label>
        <label className="block space-y-2 text-sm text-slate-600">
          <span>起止章节</span>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.chapterStartNo} onChange={(event) => setForm((current) => ({ ...current, chapterStartNo: event.target.value }))} className={textInputClass()} inputMode="numeric" placeholder="起" />
            <input value={form.chapterEndNo} onChange={(event) => setForm((current) => ({ ...current, chapterEndNo: event.target.value }))} className={textInputClass()} inputMode="numeric" placeholder="止" />
          </div>
        </label>
      </div>
      <label className="block space-y-2 text-sm text-slate-600"><span>故事核心</span><textarea value={form.storyCore} onChange={(event) => setForm((current) => ({ ...current, storyCore: event.target.value }))} className={textareaClass()} /></label>
      <label className="block space-y-2 text-sm text-slate-600"><span>主线推进</span><textarea value={form.mainPlot} onChange={(event) => setForm((current) => ({ ...current, mainPlot: event.target.value }))} className={textareaClass()} /></label>
      <label className="block space-y-2 text-sm text-slate-600"><span>支线安排</span><textarea value={form.subPlot} onChange={(event) => setForm((current) => ({ ...current, subPlot: event.target.value }))} className={textareaClass()} /></label>
      <label className="block space-y-2 text-sm text-slate-600"><span>伏笔与回收</span><textarea value={form.foreshadowing} onChange={(event) => setForm((current) => ({ ...current, foreshadowing: event.target.value }))} className={textareaClass("min-h-24")} /></label>
      <label className="block space-y-2 text-sm text-slate-600"><span>预期回报</span><textarea value={form.expectedPayoff} onChange={(event) => setForm((current) => ({ ...current, expectedPayoff: event.target.value }))} className={textareaClass("min-h-24")} /></label>
      <label className="block space-y-2 text-sm text-slate-600"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={textareaClass("min-h-24")} /></label>
    </div>
  );
}

function getEntityTypeLabel(entityType: string) {
  const resourceTypeLabels: Record<string, string> = {
    character: "角色",
    faction: "势力",
    item: "物品",
    hook: "钩子",
    worldSetting: "世界设定",
    none: "无",
  };
  return resourceTypeLabels[entityType] ?? entityType;
}

function getRelationEntityName(
  entityType: string,
  entityId: number,
  pickerSources: PickerSources,
) {
  const options = getEntityOptionsByType(entityType, pickerSources);
  return options.find((option) => option.value === String(entityId))?.label ?? `${entityType}:${entityId}`;
}

function getRelationEntitySummary(relation: RelationView, pickerSources: PickerSources) {
  const sourceName = getRelationEntityName(relation.source_type, relation.source_id, pickerSources);
  const targetName = getRelationEntityName(relation.target_type, relation.target_id, pickerSources);
  return `${sourceName} → ${targetName}`;
}

function getCardTitle(tab: ResourceKey, item: ResourceRecord) {
  if (tab === "outlines") return (item as OutlineView).title;
  if (tab === "worldSettings") return (item as WorldSettingView).title;
  if (tab === "characters") return (item as CharacterView).name;
  if (tab === "factions") return (item as FactionView).name;
  if (tab === "relations") {
    const relation = item as RelationView;
    return `${relation.source_type}:${relation.source_id} → ${relation.target_type}:${relation.target_id}`;
  }
  if (tab === "items") return (item as ItemView).name;
  return (item as StoryHookView).title;
}

function getCardMeta(tab: ResourceKey, item: ResourceRecord, pickerSources?: PickerSources) {
  if (tab === "outlines") {
    const outline = item as OutlineView;
    return `${outline.outline_level} · ${outline.volume_title ?? "未分卷"}`;
  }
  if (tab === "worldSettings") {
    const world = item as WorldSettingView;
    return `${world.category} · ${getStatusLabel(world.status)}`;
  }
  if (tab === "characters") {
    const character = item as CharacterView;
    return `${getStatusLabel(character.status)} · ${character.current_location ?? "位置未记录"}`;
  }
  if (tab === "factions") {
    const faction = item as FactionView;
    return `${faction.category ?? "未分类"} · ${getStatusLabel(faction.status)}`;
  }
  if (tab === "relations") {
    const relation = item as RelationView;
    return `${getOptionLabel(relationTypes as unknown as Option[], relation.relation_type)} · ${getStatusLabel(relation.status)}`;
  }
  if (tab === "items") {
    const resource = item as ItemView;
    const ownerSummary = resource.owner_id && pickerSources
      ? `${getEntityTypeLabel(resource.owner_type)}：${getRelationEntityName(resource.owner_type, resource.owner_id, pickerSources)}`
      : getEntityTypeLabel(resource.owner_type);
    return `${ownerSummary} · ${getStatusLabel(resource.status)}`;
  }
  const hook = item as StoryHookView;
  return `${getStatusLabel(hook.status)} · 目标章 ${hook.target_chapter_no ?? "—"}`;
}

function getCardBody(tab: ResourceKey, item: ResourceRecord) {
  if (tab === "outlines") {
    const outline = item as OutlineView;
    return outline.main_plot || outline.story_core || outline.notes || "暂无内容。";
  }
  if (tab === "worldSettings") return (item as WorldSettingView).content;
  if (tab === "characters") return (item as CharacterView).background || (item as CharacterView).goal || "暂无内容。";
  if (tab === "factions") return (item as FactionView).description || (item as FactionView).core_goal || "暂无内容。";
  if (tab === "relations") return (item as RelationView).description || "暂无内容。";
  if (tab === "items") return (item as ItemView).description || "暂无内容。";
  return (item as StoryHookView).description || "暂无内容。";
}

function getSearchableText(tab: ResourceKey, item: ResourceRecord, pickerSources?: PickerSources) {
  return `${getCardTitle(tab, item)} ${getCardMeta(tab, item, pickerSources)} ${getCardBody(tab, item)}`.toLowerCase();
}

function getStatusValue(tab: ResourceKey, item: ResourceRecord) {
  if (tab === "outlines") return "";
  if (tab === "worldSettings") return (item as WorldSettingView).status ?? "";
  if (tab === "characters") return (item as CharacterView).status ?? "";
  if (tab === "factions") return (item as FactionView).status ?? "";
  if (tab === "relations") return (item as RelationView).status ?? "";
  if (tab === "items") return (item as ItemView).status ?? "";
  return (item as StoryHookView).status ?? "";
}

function sortItems(tab: ResourceKey, items: ResourceRecord[], sortMode: string) {
  const next = [...items];
  if (sortMode === "nameAsc") {
    return next.sort((a, b) => getCardTitle(tab, a).localeCompare(getCardTitle(tab, b), "zh-CN"));
  }
  if (sortMode === "createdDesc") {
    return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function ResourcesPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const bookId = parseBookId(params.bookId);
  const safeBookId = bookId ?? 0;
  const [activeTab, setActiveTab] = useState<ResourceKey>("outlines");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<(typeof sortOptions)[number]["value"]>("updatedDesc");
  const [form, setForm] = useState<FormState>(() => getDefaultForm("outlines"));

  const activeMeta = useMemo(() => resourceTabs.find((tab) => tab.key === activeTab) ?? resourceTabs[0], [activeTab]);

  const resourceQuery = useQuery<ResourceRecord[]>({
    queryKey: queryKeys.resourceList(safeBookId, activeTab),
    queryFn: async (): Promise<ResourceRecord[]> => {
      if (activeTab === "outlines") return listOutlines(safeBookId);
      if (activeTab === "worldSettings") return listWorldSettings(safeBookId);
      if (activeTab === "characters") return listCharacters(safeBookId);
      if (activeTab === "factions") return listFactions(safeBookId);
      if (activeTab === "relations") return listRelations(safeBookId);
      if (activeTab === "items") return listItems(safeBookId);
      return listStoryHooks(safeBookId);
    },
    enabled: bookId !== null,
  });

  const charactersQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "characters", { mode: "picker" }),
    queryFn: () => listCharacters(safeBookId),
    enabled: bookId !== null,
  });
  const factionsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "factions", { mode: "picker" }),
    queryFn: () => listFactions(safeBookId),
    enabled: bookId !== null,
  });
  const itemsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "items", { mode: "picker" }),
    queryFn: () => listItems(safeBookId),
    enabled: bookId !== null,
  });
  const hooksQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "hooks", { mode: "picker" }),
    queryFn: () => listStoryHooks(safeBookId),
    enabled: bookId !== null,
  });
  const worldSettingsQuery = useQuery({
    queryKey: queryKeys.resourceList(safeBookId, "worldSettings", { mode: "picker" }),
    queryFn: () => listWorldSettings(safeBookId),
    enabled: bookId !== null,
  });

  const items = (resourceQuery.data ?? []) as ResourceRecord[];
  // pickerSources is consumed by getSearchableText below as well as the
  // resource editor; keep it referentially stable so downstream memoization
  // is meaningful and the search filter recomputes only when picker data
  // actually changes.
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

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => getStatusValue(activeTab, item)).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [activeTab, items]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    const next = items.filter((item) => {
      if (keyword && !getSearchableText(activeTab, item, pickerSources).includes(keyword)) {
        return false;
      }
      if (statusFilter !== "all") {
        return getStatusValue(activeTab, item) === statusFilter;
      }
      return true;
    });
    return sortItems(activeTab, next, sortMode);
  }, [activeTab, items, pickerSources, searchText, sortMode, statusFilter]);

  const resetForm = (tab: ResourceKey) => {
    setEditingId(null);
    setForm(getDefaultForm(tab));
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, activeTab) });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "characters", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "factions", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "items", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "hooks", { mode: "picker" }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceList(safeBookId, "worldSettings", { mode: "picker" }) }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === "outlines") {
        const validationMessage = getOutlineFormValidationMessage(form);
        if (validationMessage) {
          throw new Error(validationMessage);
        }

        const payload = buildCreatePayload(activeTab, form);
        return editingId === null
          ? createOutline(safeBookId, payload as CreateOutlineInput)
          : updateOutline(safeBookId, editingId, payload as CreateOutlineInput);
      }

      const validationMessage = getResourceFormValidationMessage(activeTab, form);
      if (validationMessage) {
        throw new Error(validationMessage);
      }

      const payload = buildResourceSavePayload(activeTab, form);
      return saveResourceRecord(safeBookId, activeTab, payload, editingId);
    },
    onSuccess: async () => {
      await refresh();
      resetForm(activeTab);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (activeTab === "outlines") return deleteOutline(safeBookId, id);
      if (activeTab === "worldSettings") return deleteWorldSetting(safeBookId, id);
      if (activeTab === "characters") return deleteCharacter(safeBookId, id);
      if (activeTab === "factions") return deleteFaction(safeBookId, id);
      if (activeTab === "relations") return deleteRelation(safeBookId, id);
      if (activeTab === "items") return deleteItem(safeBookId, id);
      return deleteStoryHook(safeBookId, id);
    },
    onSuccess: refresh,
  });

  const primaryFieldValue = activeTab === "outlines"
    ? getOutlinePrimaryFieldValue(form)
    : getResourcePrimaryFieldValue(activeTab, form);
  const validationMessage = activeTab === "outlines"
    ? getOutlineFormValidationMessage(form)
    : getResourceFormValidationMessage(activeTab, form);

  if (bookId === null) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
        URL 中的书籍编号无效，请回到书籍总览重新进入。
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">资源管理</h2>
          <p className="mt-1 text-sm text-slate-500">使用按资源类型组织的正式表单维护写作所需的结构化上下文。</p>
        </div>
        <button onClick={() => resetForm(activeTab)} className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          新建 {activeMeta.label}
        </button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_420px]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {resourceTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchText("");
                  setStatusFilter("all");
                  resetForm(tab.key);
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === tab.key ? "bg-primary text-primary-foreground shadow-glow" : "bg-slate-50 text-slate-700"
                }`}
              >
                <div className="text-sm font-medium">{tab.label}</div>
                <div className={`mt-1 text-xs ${activeTab === tab.key ? "text-primary-foreground/80" : "text-slate-500"}`}>{tab.description}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{activeMeta.label} 列表</h3>
              <p className="mt-1 text-sm text-slate-500">{activeMeta.description}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">筛选后 {filteredItems.length} 条</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} className={textInputClass()} placeholder="按名称、内容、标签搜索" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={textInputClass()}>
              <option value="all">全部状态</option>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} className={textInputClass()}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {resourceQuery.isLoading && <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">正在加载资源...</div>}
            {resourceQuery.isError && (
              <div className="rounded-2xl bg-rose-50 px-4 py-6 text-sm text-rose-700">
                {formatApiErrorMessage(resourceQuery.error, "资源加载失败")}
              </div>
            )}
            {!resourceQuery.isLoading && !resourceQuery.isError && filteredItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                当前筛选条件下没有结果，可调整搜索条件或直接在右侧创建新资源。
              </div>
            )}
            {filteredItems.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">{getCardTitle(activeTab, item)}</h4>
                    {activeTab === "relations" && (
                      <p className="mt-1 text-xs text-slate-500">{getRelationEntitySummary(item as RelationView, pickerSources)}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{getCardMeta(activeTab, item, pickerSources)}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setForm(buildFormFromItem(activeTab, item));
                      }}
                      className="rounded-full bg-white px-3 py-1 text-slate-700"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`确定删除该 ${activeMeta.label} 吗？此操作不可撤销。`)) {
                          return;
                        }
                        deleteMutation.mutate(item.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 disabled:opacity-60"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-slate-600">{getCardBody(activeTab, item)}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{editingId === null ? `新建 ${activeMeta.label}` : `编辑 #${editingId}`}</h3>
              <p className="mt-1 text-xs text-slate-500">字段按资源类型定制，不再依赖通用 title/subtitle/body/extra 输入。</p>
            </div>
            {editingId !== null && (
              <button onClick={() => resetForm(activeTab)} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                取消编辑
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4 text-sm">
            {activeTab === "outlines" ? renderOutlineForm(form, setForm) : (
              <ResourceEditorForm resourceType={activeTab} form={form} setForm={setForm} pickerSources={pickerSources} />
            )}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !primaryFieldValue?.trim() || validationMessage !== null}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? "保存中..." : editingId === null ? "创建资源" : "保存修改"}
            </button>

            <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              {saveMutation.isError
                ? formatApiErrorMessage(saveMutation.error, "保存失败")
                : validationMessage
                  ? validationMessage
                  : deleteMutation.isError
                    ? formatApiErrorMessage(deleteMutation.error, "删除失败")
                    : "Relations 支持可视化选择起点/终点实体；Items 支持 owner picker；Factions 支持 leader picker；顶部支持搜索、状态筛选与排序。"}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
