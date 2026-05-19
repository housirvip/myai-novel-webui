import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { CharacterView, FactionView } from "@/lib/types";

import {
  characterStatusOptions,
  factionCategoryOptions,
  factionStatusOptions,
  getEntityOptionsByType,
  hookStatusOptions,
  hookTypeOptions,
  itemCategoryOptions,
  itemOwnerTypes,
  itemRarityOptions,
  itemStatusOptions,
  relationEntityTypes,
  relationStatusOptions,
  relationTypes,
  worldSettingCategoryOptions,
  worldSettingStatusOptions,
  type EditableResourceKey,
  type PickerSources,
  type ResourceEditorFormState,
} from "./resource-editor-shared";

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm text-slate-600">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function textInputClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary";
}

function textareaClass(minHeight = "min-h-28") {
  return `${minHeight} w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary`;
}

export function ResourceEditorForm(props: {
  resourceType: EditableResourceKey;
  form: ResourceEditorFormState;
  setForm: Dispatch<SetStateAction<ResourceEditorFormState>>;
  pickerSources: PickerSources;
}) {
  const leaderOptions = props.pickerSources.characters.map((item: CharacterView) => ({ value: String(item.id), label: item.name }));
  const relationSourceOptions = getEntityOptionsByType(props.form.sourceType ?? "character", props.pickerSources);
  const relationTargetOptions = getEntityOptionsByType(props.form.targetType ?? "faction", props.pickerSources);
  const itemOwnerOptions = props.form.ownerType === "character"
    ? props.pickerSources.characters.map((item: CharacterView) => ({ value: String(item.id), label: item.name }))
    : props.form.ownerType === "faction"
      ? props.pickerSources.factions.map((item: FactionView) => ({ value: String(item.id), label: item.name }))
      : [];

  if (props.resourceType === "worldSettings") {
    return (
      <div className="space-y-3">
        <Field label="标题"><input value={props.form.title} onChange={(event) => props.setForm((current) => ({ ...current, title: event.target.value }))} className={textInputClass()} /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="分类">
            <select value={props.form.category} onChange={(event) => props.setForm((current) => ({ ...current, category: event.target.value }))} className={textInputClass()}>
              {worldSettingCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
              {worldSettingStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="设定正文"><textarea value={props.form.content} onChange={(event) => props.setForm((current) => ({ ...current, content: event.target.value }))} className={textareaClass("min-h-40")} /></Field>
        <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
      </div>
    );
  }

  if (props.resourceType === "characters") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="姓名"><input value={props.form.name} onChange={(event) => props.setForm((current) => ({ ...current, name: event.target.value }))} className={textInputClass()} /></Field>
          <Field label="别名"><input value={props.form.alias} onChange={(event) => props.setForm((current) => ({ ...current, alias: event.target.value }))} className={textInputClass()} /></Field>
          <Field label="性别"><input value={props.form.gender} onChange={(event) => props.setForm((current) => ({ ...current, gender: event.target.value }))} className={textInputClass()} /></Field>
          <Field label="年龄"><input value={props.form.age} onChange={(event) => props.setForm((current) => ({ ...current, age: event.target.value }))} className={textInputClass()} inputMode="numeric" /></Field>
          <Field label="状态">
            <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
              {characterStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="当前位置"><input value={props.form.currentLocation} onChange={(event) => props.setForm((current) => ({ ...current, currentLocation: event.target.value }))} className={textInputClass()} /></Field>
        </div>
        <Field label="性格"><textarea value={props.form.personality} onChange={(event) => props.setForm((current) => ({ ...current, personality: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="背景"><textarea value={props.form.background} onChange={(event) => props.setForm((current) => ({ ...current, background: event.target.value }))} className={textareaClass("min-h-32")} /></Field>
        <Field label="职业"><input value={props.form.professions} onChange={(event) => props.setForm((current) => ({ ...current, professions: event.target.value }))} className={textInputClass()} /></Field>
        <Field label="等级/境界"><input value={props.form.levels} onChange={(event) => props.setForm((current) => ({ ...current, levels: event.target.value }))} className={textInputClass()} /></Field>
        <Field label="货币/资源"><input value={props.form.currencies} onChange={(event) => props.setForm((current) => ({ ...current, currencies: event.target.value }))} className={textInputClass()} /></Field>
        <Field label="能力"><textarea value={props.form.abilities} onChange={(event) => props.setForm((current) => ({ ...current, abilities: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="目标"><textarea value={props.form.goal} onChange={(event) => props.setForm((current) => ({ ...current, goal: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
      </div>
    );
  }

  if (props.resourceType === "factions") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="势力名称"><input value={props.form.name} onChange={(event) => props.setForm((current) => ({ ...current, name: event.target.value }))} className={textInputClass()} /></Field>
          <Field label="分类">
            <select value={props.form.category} onChange={(event) => props.setForm((current) => ({ ...current, category: event.target.value }))} className={textInputClass()}>
              {factionCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
              {factionStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="总部"><input value={props.form.headquarter} onChange={(event) => props.setForm((current) => ({ ...current, headquarter: event.target.value }))} className={textInputClass()} /></Field>
        </div>
        <Field label="领袖角色">
          <select value={props.form.leaderCharacterId} onChange={(event) => props.setForm((current) => ({ ...current, leaderCharacterId: event.target.value }))} className={textInputClass()}>
            <option value="">未设置</option>
            {leaderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="核心目标"><textarea value={props.form.coreGoal} onChange={(event) => props.setForm((current) => ({ ...current, coreGoal: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="描述"><textarea value={props.form.description} onChange={(event) => props.setForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass("min-h-32")} /></Field>
        <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
      </div>
    );
  }

  if (props.resourceType === "relations") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="起点类型">
            <select value={props.form.sourceType} onChange={(event) => props.setForm((current) => ({ ...current, sourceType: event.target.value, sourceId: "" }))} className={textInputClass()}>
              {relationEntityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="终点类型">
            <select value={props.form.targetType} onChange={(event) => props.setForm((current) => ({ ...current, targetType: event.target.value, targetId: "" }))} className={textInputClass()}>
              {relationEntityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="起点实体">
            <select value={props.form.sourceId} onChange={(event) => props.setForm((current) => ({ ...current, sourceId: event.target.value }))} className={textInputClass()}>
              <option value="">请选择</option>
              {relationSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="终点实体">
            <select value={props.form.targetId} onChange={(event) => props.setForm((current) => ({ ...current, targetId: event.target.value }))} className={textInputClass()}>
              <option value="">请选择</option>
              {relationTargetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="关系类型">
            <select value={props.form.relationType} onChange={(event) => props.setForm((current) => ({ ...current, relationType: event.target.value }))} className={textInputClass()}>
              {relationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="强度"><input value={props.form.intensity} onChange={(event) => props.setForm((current) => ({ ...current, intensity: event.target.value }))} className={textInputClass()} inputMode="numeric" /></Field>
        </div>
        <Field label="状态">
          <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
            {relationStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="描述"><textarea value={props.form.description} onChange={(event) => props.setForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass("min-h-28")} /></Field>
        <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
      </div>
    );
  }

  if (props.resourceType === "items") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="物品名称"><input value={props.form.name} onChange={(event) => props.setForm((current) => ({ ...current, name: event.target.value }))} className={textInputClass()} /></Field>
          <Field label="分类">
            <select value={props.form.category} onChange={(event) => props.setForm((current) => ({ ...current, category: event.target.value }))} className={textInputClass()}>
              {itemCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="稀有度">
            <select value={props.form.rarity} onChange={(event) => props.setForm((current) => ({ ...current, rarity: event.target.value }))} className={textInputClass()}>
              <option value="">未设置</option>
              {itemRarityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
              {itemStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="归属类型">
            <select value={props.form.ownerType} onChange={(event) => props.setForm((current) => ({ ...current, ownerType: event.target.value, ownerId: "" }))} className={textInputClass()}>
              {itemOwnerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="归属实体">
            <select value={props.form.ownerId} onChange={(event) => props.setForm((current) => ({ ...current, ownerId: event.target.value }))} className={textInputClass()} disabled={props.form.ownerType === "none"}>
              <option value="">未设置</option>
              {itemOwnerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="描述"><textarea value={props.form.description} onChange={(event) => props.setForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass("min-h-32")} /></Field>
        <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
        <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="标题"><input value={props.form.title} onChange={(event) => props.setForm((current) => ({ ...current, title: event.target.value }))} className={textInputClass()} /></Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="钩子类型">
          <select value={props.form.hookType} onChange={(event) => props.setForm((current) => ({ ...current, hookType: event.target.value }))} className={textInputClass()}>
            <option value="">未设置</option>
            {hookTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="状态">
          <select value={props.form.status} onChange={(event) => props.setForm((current) => ({ ...current, status: event.target.value }))} className={textInputClass()}>
            {hookStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="来源章节"><input value={props.form.sourceChapterNo} onChange={(event) => props.setForm((current) => ({ ...current, sourceChapterNo: event.target.value }))} className={textInputClass()} inputMode="numeric" /></Field>
        <Field label="目标章节"><input value={props.form.targetChapterNo} onChange={(event) => props.setForm((current) => ({ ...current, targetChapterNo: event.target.value }))} className={textInputClass()} inputMode="numeric" /></Field>
        <Field label="重要性"><input value={props.form.importance} onChange={(event) => props.setForm((current) => ({ ...current, importance: event.target.value }))} className={textInputClass()} /></Field>
      </div>
      <Field label="描述"><textarea value={props.form.description} onChange={(event) => props.setForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass("min-h-32")} /></Field>
      <Field label="附加备注"><textarea value={props.form.appendNotes} onChange={(event) => props.setForm((current) => ({ ...current, appendNotes: event.target.value }))} className={textareaClass("min-h-24")} /></Field>
      <Field label="关键词"><input value={props.form.keywords} onChange={(event) => props.setForm((current) => ({ ...current, keywords: event.target.value }))} className={textInputClass()} placeholder="逗号分隔" /></Field>
    </div>
  );
}
