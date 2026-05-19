import {
  createCharacter,
  createFaction,
  createItem,
  createRelation,
  createStoryHook,
  createWorldSetting,
  updateCharacter,
  updateFaction,
  updateItem,
  updateRelation,
  updateStoryHook,
  updateWorldSetting,
} from "@/lib/resources-api";
import type {
  CharacterView,
  CreateCharacterInput,
  CreateFactionInput,
  CreateItemInput,
  CreateRelationInput,
  CreateStoryHookInput,
  CreateWorldSettingInput,
  FactionView,
  ItemView,
  RelationView,
  StoryHookView,
  UpdateCharacterInput,
  UpdateFactionInput,
  UpdateItemInput,
  UpdateRelationInput,
  UpdateStoryHookInput,
  UpdateWorldSettingInput,
  WorldSettingView,
} from "@/lib/types";

export type EditableResourceKey = "worldSettings" | "characters" | "factions" | "relations" | "items" | "hooks";
export type EditableResourceRecord = WorldSettingView | CharacterView | FactionView | RelationView | ItemView | StoryHookView;
export type ResourceEditorFormState = Record<string, string>;
export type ResourceOption = { value: string; label: string };
export type PickerSources = {
  characters: CharacterView[];
  factions: FactionView[];
  items: ItemView[];
  hooks: StoryHookView[];
  worldSettings: WorldSettingView[];
};

export const relationEntityTypes = [
  { value: "character", label: "角色" },
  { value: "faction", label: "势力" },
  { value: "item", label: "物品" },
  { value: "hook", label: "钩子" },
  { value: "worldSetting", label: "世界设定" },
] as const;
export const relationTypes = [
  { value: "member", label: "成员" },
  { value: "friend", label: "普通朋友" },
  { value: "close_friend", label: "挚友" },
  { value: "sworn_ally", label: "生死之交" },
  { value: "ally", label: "同盟" },
  { value: "enemy", label: "敌对" },
  { value: "mentor", label: "导师" },
  { value: "student", label: "学生" },
  { value: "partner", label: "搭档" },
  { value: "lover", label: "情侣" },
  { value: "spouse", label: "夫妻" },
  { value: "family", label: "亲属" },
  { value: "owner", label: "归属" },
  { value: "subordinate", label: "下属" },
  { value: "leader", label: "领导" },
  { value: "rival", label: "竞争" },
  { value: "other", label: "其他" },
] as const;
export const itemOwnerTypes = ["none", "character", "faction"] as const;
export const worldSettingStatusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
  { value: "archived", label: "归档" },
] as const;
export const characterStatusOptions = [
  { value: "alive", label: "存活" },
  { value: "dead", label: "死亡" },
  { value: "missing", label: "失踪" },
  { value: "retired", label: "退场" },
] as const;
export const factionStatusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
  { value: "dissolved", label: "解散" },
] as const;
export const relationStatusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
  { value: "broken", label: "断裂" },
] as const;
export const itemStatusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
  { value: "lost", label: "遗失" },
  { value: "destroyed", label: "毁坏" },
] as const;
export const worldSettingCategoryOptions = [
  { value: "世界设定", label: "世界设定" },
  { value: "职业设定", label: "职业设定" },
  { value: "规则设定", label: "规则设定" },
  { value: "地理", label: "地理" },
  { value: "组织", label: "组织" },
  { value: "历史", label: "历史" },
  { value: "文化", label: "文化" },
] as const;
export const factionCategoryOptions = [
  { value: "宗门", label: "宗门" },
  { value: "势力", label: "势力" },
  { value: "组织", label: "组织" },
  { value: "家族", label: "家族" },
  { value: "王朝", label: "王朝" },
  { value: "商会", label: "商会" },
] as const;
export const itemCategoryOptions = [
  { value: "武器", label: "武器" },
  { value: "防具", label: "防具" },
  { value: "法宝", label: "法宝" },
  { value: "材料", label: "材料" },
  { value: "丹药", label: "丹药" },
  { value: "令牌", label: "令牌" },
  { value: "道具", label: "道具" },
] as const;
export const itemRarityOptions = [
  { value: "common", label: "普通" },
  { value: "uncommon", label: "稀有" },
  { value: "rare", label: "珍贵" },
  { value: "epic", label: "史诗" },
  { value: "legendary", label: "传说" },
  { value: "artifact", label: "神器" },
] as const;
export const hookStatusOptions = [
  { value: "open", label: "开放" },
  { value: "closed", label: "关闭" },
  { value: "resolved", label: "已解决" },
] as const;
export const hookTypeOptions = [
  { value: "foreshadowing", label: "伏笔" },
  { value: "mystery", label: "谜团" },
  { value: "conflict", label: "冲突" },
  { value: "quest", label: "任务" },
  { value: "reveal", label: "揭示" },
  { value: "payoff", label: "回收" },
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

export function getEntityOptionsByType(type: string, sources: PickerSources): ResourceOption[] {
  if (type === "character") return sources.characters.map((item) => ({ value: String(item.id), label: item.name }));
  if (type === "faction") return sources.factions.map((item) => ({ value: String(item.id), label: item.name }));
  if (type === "item") return sources.items.map((item) => ({ value: String(item.id), label: item.name }));
  if (type === "hook") return sources.hooks.map((item) => ({ value: String(item.id), label: item.title }));
  return sources.worldSettings.map((item) => ({ value: String(item.id), label: item.title }));
}

export function getDefaultResourceForm(resourceType: EditableResourceKey): ResourceEditorFormState {
  if (resourceType === "worldSettings") {
    return { title: "", category: "世界设定", content: "", status: "active", appendNotes: "", keywords: "" };
  }
  if (resourceType === "characters") {
    return {
      name: "",
      alias: "",
      gender: "",
      age: "",
      personality: "",
      background: "",
      currentLocation: "",
      status: "alive",
      professions: "",
      levels: "",
      currencies: "",
      abilities: "",
      goal: "",
      appendNotes: "",
      keywords: "",
    };
  }
  if (resourceType === "factions") {
    return {
      name: "",
      category: "",
      coreGoal: "",
      description: "",
      leaderCharacterId: "",
      headquarter: "",
      status: "active",
      appendNotes: "",
      keywords: "",
    };
  }
  if (resourceType === "relations") {
    return {
      sourceType: "character",
      sourceId: "",
      targetType: "faction",
      targetId: "",
      relationType: "member",
      intensity: "",
      status: "active",
      description: "",
      appendNotes: "",
      keywords: "",
    };
  }
  if (resourceType === "items") {
    return {
      name: "",
      category: "",
      description: "",
      ownerType: "none",
      ownerId: "",
      rarity: "",
      status: "active",
      appendNotes: "",
      keywords: "",
    };
  }
  return {
    title: "",
    hookType: "",
    description: "",
    sourceChapterNo: "",
    targetChapterNo: "",
    status: "open",
    importance: "",
    appendNotes: "",
    keywords: "",
  };
}

export function buildResourceFormFromItem(resourceType: EditableResourceKey, item: EditableResourceRecord): ResourceEditorFormState {
  if (resourceType === "worldSettings") {
    const world = item as WorldSettingView;
    return {
      title: world.title,
      category: world.category,
      content: world.content,
      status: world.status,
      appendNotes: world.appendNotes ?? "",
      keywords: world.keywords ?? "",
    };
  }
  if (resourceType === "characters") {
    const character = item as CharacterView;
    return {
      name: character.name,
      alias: character.alias ?? "",
      gender: character.gender ?? "",
      age: character.age ? String(character.age) : "",
      personality: character.personality ?? "",
      background: character.background ?? "",
      currentLocation: character.currentLocation ?? "",
      status: character.status,
      professions: character.professions ?? "",
      levels: character.levels ?? "",
      currencies: character.currencies ?? "",
      abilities: character.abilities ?? "",
      goal: character.goal ?? "",
      appendNotes: character.appendNotes ?? "",
      keywords: character.keywords ?? "",
    };
  }
  if (resourceType === "factions") {
    const faction = item as FactionView;
    return {
      name: faction.name,
      category: faction.category ?? "",
      coreGoal: faction.coreGoal ?? "",
      description: faction.description ?? "",
      leaderCharacterId: faction.leaderCharacterId ? String(faction.leaderCharacterId) : "",
      headquarter: faction.headquarter ?? "",
      status: faction.status ?? "",
      appendNotes: faction.appendNotes ?? "",
      keywords: faction.keywords ?? "",
    };
  }
  if (resourceType === "relations") {
    const relation = item as RelationView;
    return {
      sourceType: relation.sourceType,
      sourceId: String(relation.sourceId),
      targetType: relation.targetType,
      targetId: String(relation.targetId),
      relationType: relation.relationType,
      intensity: relation.intensity ? String(relation.intensity) : "",
      status: relation.status ?? "",
      description: relation.description ?? "",
      appendNotes: relation.appendNotes ?? "",
      keywords: relation.keywords ?? "",
    };
  }
  if (resourceType === "items") {
    const resource = item as ItemView;
    return {
      name: resource.name,
      category: resource.category ?? "",
      description: resource.description ?? "",
      ownerType: resource.ownerType,
      ownerId: resource.ownerId ? String(resource.ownerId) : "",
      rarity: resource.rarity ?? "",
      status: resource.status ?? "",
      appendNotes: resource.appendNotes ?? "",
      keywords: resource.keywords ?? "",
    };
  }
  const hook = item as StoryHookView;
  return {
    title: hook.title,
    hookType: hook.hookType ?? "",
    description: hook.description ?? "",
    sourceChapterNo: hook.sourceChapterNo ? String(hook.sourceChapterNo) : "",
    targetChapterNo: hook.targetChapterNo ? String(hook.targetChapterNo) : "",
    status: hook.status,
    importance: hook.importance ?? "",
    appendNotes: hook.appendNotes ?? "",
    keywords: hook.keywords ?? "",
  };
}

export function buildResourceSavePayload(resourceType: EditableResourceKey, form: ResourceEditorFormState):
  | CreateWorldSettingInput
  | CreateCharacterInput
  | CreateFactionInput
  | CreateRelationInput
  | CreateItemInput
  | CreateStoryHookInput {
  if (resourceType === "worldSettings") {
    return {
      title: form.title.trim(),
      category: form.category.trim() || "设定",
      content: form.content.trim(),
      status: form.status.trim() || "active",
      appendNotes: toNullableString(form.appendNotes),
      keywords: toNullableString(form.keywords),
    };
  }
  if (resourceType === "characters") {
    return {
      name: form.name.trim(),
      alias: toNullableString(form.alias),
      gender: toNullableString(form.gender),
      age: toNullableNumber(form.age),
      personality: toNullableString(form.personality),
      background: toNullableString(form.background),
      currentLocation: toNullableString(form.currentLocation),
      status: form.status.trim() || "alive",
      professions: toNullableString(form.professions),
      levels: toNullableString(form.levels),
      currencies: toNullableString(form.currencies),
      abilities: toNullableString(form.abilities),
      goal: toNullableString(form.goal),
      appendNotes: toNullableString(form.appendNotes),
      keywords: toNullableString(form.keywords),
    };
  }
  if (resourceType === "factions") {
    return {
      name: form.name.trim(),
      category: toNullableString(form.category),
      coreGoal: toNullableString(form.coreGoal),
      description: toNullableString(form.description),
      leaderCharacterId: toNullableNumber(form.leaderCharacterId),
      headquarter: toNullableString(form.headquarter),
      status: toNullableString(form.status),
      appendNotes: toNullableString(form.appendNotes),
      keywords: toNullableString(form.keywords),
    };
  }
  if (resourceType === "relations") {
    return {
      sourceType: form.sourceType,
      sourceId: Number(form.sourceId),
      targetType: form.targetType,
      targetId: Number(form.targetId),
      relationType: form.relationType.trim(),
      intensity: toNullableNumber(form.intensity),
      status: toNullableString(form.status),
      description: toNullableString(form.description),
      appendNotes: toNullableString(form.appendNotes),
      keywords: toNullableString(form.keywords),
    };
  }
  if (resourceType === "items") {
    return {
      name: form.name.trim(),
      category: toNullableString(form.category),
      description: toNullableString(form.description),
      ownerType: form.ownerType || "none",
      ownerId: form.ownerType === "none" ? null : toNullableNumber(form.ownerId),
      rarity: toNullableString(form.rarity),
      status: toNullableString(form.status),
      appendNotes: toNullableString(form.appendNotes),
      keywords: toNullableString(form.keywords),
    };
  }
  return {
    title: form.title.trim(),
    hookType: toNullableString(form.hookType),
    description: toNullableString(form.description),
    sourceChapterNo: toNullableNumber(form.sourceChapterNo),
    targetChapterNo: toNullableNumber(form.targetChapterNo),
    status: form.status.trim() || "open",
    importance: toNullableString(form.importance),
    appendNotes: toNullableString(form.appendNotes),
    keywords: toNullableString(form.keywords),
  };
}

export function getResourceFormValidationMessage(resourceType: EditableResourceKey, form: ResourceEditorFormState) {
  if (resourceType === "worldSettings") {
    if (!form.title.trim()) return "请先填写标题。";
    if (!form.content.trim()) return "请先填写设定正文。";
    return null;
  }
  if (resourceType === "characters") {
    return form.name.trim() ? null : "请先填写姓名。";
  }
  if (resourceType === "factions") {
    return form.name.trim() ? null : "请先填写势力名称。";
  }
  if (resourceType === "relations") {
    if (!form.relationType.trim()) return "请先填写关系类型。";
    if (!toNullableNumber(form.sourceId)) return "请先选择起点实体。";
    if (!toNullableNumber(form.targetId)) return "请先选择终点实体。";
    return null;
  }
  if (resourceType === "items") {
    if (!form.name.trim()) return "请先填写物品名称。";
    if (form.ownerType !== "none" && !toNullableNumber(form.ownerId)) {
      return "已选择归属类型时，必须选择归属实体。";
    }
    return null;
  }
  return form.title.trim() ? null : "请先填写标题。";
}

export function getResourcePrimaryFieldValue(resourceType: EditableResourceKey, form: ResourceEditorFormState) {
  if (resourceType === "characters" || resourceType === "factions" || resourceType === "items") {
    return form.name;
  }
  if (resourceType === "relations") {
    return form.relationType;
  }
  return form.title;
}

export async function saveResourceRecord(
  bookId: number,
  resourceType: EditableResourceKey,
  payload:
    | CreateWorldSettingInput
    | CreateCharacterInput
    | CreateFactionInput
    | CreateRelationInput
    | CreateItemInput
    | CreateStoryHookInput,
  editingId?: number | null,
) {
  if (editingId == null) {
    if (resourceType === "worldSettings") return createWorldSetting(bookId, payload as CreateWorldSettingInput);
    if (resourceType === "characters") return createCharacter(bookId, payload as CreateCharacterInput);
    if (resourceType === "factions") return createFaction(bookId, payload as CreateFactionInput);
    if (resourceType === "relations") return createRelation(bookId, payload as CreateRelationInput);
    if (resourceType === "items") return createItem(bookId, payload as CreateItemInput);
    return createStoryHook(bookId, payload as CreateStoryHookInput);
  }

  if (resourceType === "worldSettings") return updateWorldSetting(bookId, editingId, payload as UpdateWorldSettingInput);
  if (resourceType === "characters") return updateCharacter(bookId, editingId, payload as UpdateCharacterInput);
  if (resourceType === "factions") return updateFaction(bookId, editingId, payload as UpdateFactionInput);
  if (resourceType === "relations") return updateRelation(bookId, editingId, payload as UpdateRelationInput);
  if (resourceType === "items") return updateItem(bookId, editingId, payload as UpdateItemInput);
  return updateStoryHook(bookId, editingId, payload as UpdateStoryHookInput);
}
