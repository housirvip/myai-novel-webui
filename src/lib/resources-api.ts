import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  CharacterView,
  CreateCharacterInput,
  CreateFactionInput,
  CreateItemInput,
  CreateOutlineInput,
  CreateRelationInput,
  CreateStoryHookInput,
  CreateWorldSettingInput,
  FactionView,
  ItemView,
  OutlineView,
  RelationView,
  StoryHookView,
  UpdateCharacterInput,
  UpdateFactionInput,
  UpdateItemInput,
  UpdateOutlineInput,
  UpdateRelationInput,
  UpdateStoryHookInput,
  UpdateWorldSettingInput,
  WorldSettingView,
} from "@/lib/types";

export function listOutlines(bookId: number, limit = 50) {
  return apiGet<OutlineView[]>(`/api/books/${bookId}/outlines?limit=${limit}`);
}

export function createOutline(bookId: number, input: CreateOutlineInput) {
  return apiPost<OutlineView, CreateOutlineInput>(`/api/books/${bookId}/outlines`, input);
}

export function updateOutline(bookId: number, outlineId: number, input: UpdateOutlineInput) {
  return apiPatch<OutlineView, UpdateOutlineInput>(`/api/books/${bookId}/outlines/${outlineId}`, input);
}

export function deleteOutline(bookId: number, outlineId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/outlines/${outlineId}`);
}

export function listWorldSettings(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<WorldSettingView[]>(`/api/books/${bookId}/world-settings?${params.toString()}`);
}

export function createWorldSetting(bookId: number, input: CreateWorldSettingInput) {
  return apiPost<WorldSettingView, CreateWorldSettingInput>(`/api/books/${bookId}/world-settings`, input);
}

export function updateWorldSetting(bookId: number, worldSettingId: number, input: UpdateWorldSettingInput) {
  return apiPatch<WorldSettingView, UpdateWorldSettingInput>(`/api/books/${bookId}/world-settings/${worldSettingId}`, input);
}

export function deleteWorldSetting(bookId: number, worldSettingId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/world-settings/${worldSettingId}`);
}

export function listCharacters(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<CharacterView[]>(`/api/books/${bookId}/characters?${params.toString()}`);
}

export function createCharacter(bookId: number, input: CreateCharacterInput) {
  return apiPost<CharacterView, CreateCharacterInput>(`/api/books/${bookId}/characters`, input);
}

export function updateCharacter(bookId: number, characterId: number, input: UpdateCharacterInput) {
  return apiPatch<CharacterView, UpdateCharacterInput>(`/api/books/${bookId}/characters/${characterId}`, input);
}

export function deleteCharacter(bookId: number, characterId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/characters/${characterId}`);
}

export function listFactions(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<FactionView[]>(`/api/books/${bookId}/factions?${params.toString()}`);
}

export function createFaction(bookId: number, input: CreateFactionInput) {
  return apiPost<FactionView, CreateFactionInput>(`/api/books/${bookId}/factions`, input);
}

export function updateFaction(bookId: number, factionId: number, input: UpdateFactionInput) {
  return apiPatch<FactionView, UpdateFactionInput>(`/api/books/${bookId}/factions/${factionId}`, input);
}

export function deleteFaction(bookId: number, factionId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/factions/${factionId}`);
}

export function listRelations(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<RelationView[]>(`/api/books/${bookId}/relations?${params.toString()}`);
}

export function createRelation(bookId: number, input: CreateRelationInput) {
  return apiPost<RelationView, CreateRelationInput>(`/api/books/${bookId}/relations`, input);
}

export function updateRelation(bookId: number, relationId: number, input: UpdateRelationInput) {
  return apiPatch<RelationView, UpdateRelationInput>(`/api/books/${bookId}/relations/${relationId}`, input);
}

export function deleteRelation(bookId: number, relationId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/relations/${relationId}`);
}

export function listItems(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<ItemView[]>(`/api/books/${bookId}/items?${params.toString()}`);
}

export function createItem(bookId: number, input: CreateItemInput) {
  return apiPost<ItemView, CreateItemInput>(`/api/books/${bookId}/items`, input);
}

export function updateItem(bookId: number, itemId: number, input: UpdateItemInput) {
  return apiPatch<ItemView, UpdateItemInput>(`/api/books/${bookId}/items/${itemId}`, input);
}

export function deleteItem(bookId: number, itemId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/items/${itemId}`);
}

export function listStoryHooks(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet<StoryHookView[]>(`/api/books/${bookId}/hooks?${params.toString()}`);
}

export function createStoryHook(bookId: number, input: CreateStoryHookInput) {
  return apiPost<StoryHookView, CreateStoryHookInput>(`/api/books/${bookId}/hooks`, input);
}

export function updateStoryHook(bookId: number, hookId: number, input: UpdateStoryHookInput) {
  return apiPatch<StoryHookView, UpdateStoryHookInput>(`/api/books/${bookId}/hooks/${hookId}`, input);
}

export function deleteStoryHook(bookId: number, hookId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/hooks/${hookId}`);
}
