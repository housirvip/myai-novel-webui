export interface LlmSecretFieldView {
  hasValue: boolean;
  maskedValue: string | null;
}

export interface LlmRuntimeSettingsView {
  provider?: "mock" | "openai" | "anthropic" | "custom";
  model?: string;
  lowModel?: string;
  midModel?: string;
  highModel?: string;
  defaultMaxTokens?: number;
  openaiApiKey: LlmSecretFieldView;
  openaiBaseUrl?: string;
  anthropicApiKey: LlmSecretFieldView;
  anthropicBaseUrl?: string;
  customLlmApiKey: LlmSecretFieldView;
  customLlmBaseUrl?: string;
}

export interface RuntimeCapabilitiesView {
  allowedProviders: Array<"mock" | "openai" | "anthropic" | "custom">;
  providerAvailability: Record<"mock" | "openai" | "anthropic" | "custom", boolean>;
  supportsSensitiveOverrides: boolean;
}

export interface UserRuntimeSettingsView {
  overrides: LlmRuntimeSettingsView;
  serverDefaults: LlmRuntimeSettingsView;
  effective: LlmRuntimeSettingsView;
  capabilities: RuntimeCapabilitiesView;
}

export interface UserRuntimeSettingsUpdateInput {
  llmProvider?: "mock" | "openai" | "anthropic" | "custom" | null;
  llmModel?: string | null;
  llmLowModel?: string | null;
  llmMidModel?: string | null;
  llmHighModel?: string | null;
  llmDefaultMaxTokens?: number | null;
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  anthropicApiKey?: string | null;
  anthropicBaseUrl?: string | null;
  customLlmApiKey?: string | null;
  customLlmBaseUrl?: string | null;
}

export interface SessionUserView {
  id: number;
  email: string;
  displayName: string;
  status: string;
}

export interface AuthSessionView {
  user: SessionUserView | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export interface BookView {
  id: number;
  title: string;
  summary: string | null;
  target_chapter_count: number | null;
  current_chapter_count: number;
  status: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookInput {
  title: string;
  summary?: string;
  targetChapterCount?: number;
  status?: string;
}

export type UpdateBookInput = Partial<CreateBookInput>;

export interface CreateChapterInput {
  chapterNo: number;
  title?: string | null;
  summary?: string | null;
  wordCount?: number | null;
  targetWordCount?: number | null;
  status?: string;
  actualCharacterIds?: string | null;
  actualFactionIds?: string | null;
  actualItemIds?: string | null;
  actualHookIds?: string | null;
  actualWorldSettingIds?: string | null;
}

export type UpdateChapterInput = Partial<CreateChapterInput>;

export interface ChapterView {
  id: number;
  book_id: number;
  chapter_no: number;
  title: string | null;
  summary: string | null;
  word_count: number | null;
  target_word_count: number | null;
  status: string;
  current_plan_id: number | null;
  current_draft_id: number | null;
  current_review_id: number | null;
  current_final_id: number | null;
  actual_character_ids: string | null;
  actual_faction_ids: string | null;
  actual_item_ids: string | null;
  actual_hook_ids: string | null;
  actual_world_setting_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterWorkflowStateView {
  status: string;
  currentPlanId: number | null;
  currentDraftId: number | null;
  currentReviewId: number | null;
  currentFinalId: number | null;
  availableActions: string[];
  hasPlan: boolean;
  hasDraft: boolean;
  hasReview: boolean;
  hasFinal: boolean;
}

export type ChapterStage = "plan" | "draft" | "review" | "final";
export type ChapterWritableStage = Exclude<ChapterStage, "review">;

export interface ChapterStageView {
  metadata: {
    bookId: number;
    chapterNo: number;
    stage: ChapterStage;
    title: string | null;
    status: string;
    wordCount: number | null;
    targetWordCount: number | null;
    updatedAt: string;
  };
  summary: string | null;
  content: string;
}

export interface ChapterStageHistoryEntry {
  id: number;
  versionNo: number;
  stage: ChapterStage;
  summary: string | null;
  content: string;
  wordCount: number | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface UpdateStageInput {
  summary?: string | null;
  content: string;
}

export interface WorkflowBaseInput {
  bookId: number;
  chapterNo: number;
  provider?: "mock" | "openai" | "anthropic" | "custom";
  lowModel?: string;
  midModel?: string;
  highModel?: string;
}

export interface PlanWorkflowInput extends WorkflowBaseInput {
  authorIntent?: string;
  targetWords?: number;
  manualEntityRefs?: {
    characterIds: number[];
    factionIds: number[];
    itemIds: number[];
    hookIds: number[];
    relationIds: number[];
    worldSettingIds: number[];
  };
}

export interface GenerateAuthorIntentInput extends WorkflowBaseInput {
  manualEntityRefs?: {
    characterIds: number[];
    factionIds: number[];
    itemIds: number[];
    hookIds: number[];
    relationIds: number[];
    worldSettingIds: number[];
  };
}

export interface GenerateAuthorIntentResult {
  authorIntent: string;
}

export interface GenerateStageSummaryInput extends WorkflowBaseInput {
  stage: ChapterWritableStage;
  content: string;
}

export interface GenerateStageSummaryResult {
  summary: string;
}

export interface DraftWorkflowInput extends WorkflowBaseInput {
  targetWords?: number;
}

export type WorkflowTaskType = "author_intent" | "plan" | "draft" | "review" | "repair" | "approve";
export type WorkflowTaskStatus = "pending" | "running" | "terminating" | "terminated" | "succeeded" | "failed";

export interface WorkflowTaskView {
  id: number;
  bookId: number;
  chapterId: number;
  chapterNo: number;
  workflowType: WorkflowTaskType;
  status: WorkflowTaskStatus;
  stage: string | null;
  progressPercent: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  currentPlanId: number | null;
  currentDraftId: number | null;
  result: unknown;
  error: null | {
    code: string | null;
    message: string | null;
    details: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApproveWorkflowInput extends WorkflowBaseInput {
  dryRun?: boolean;
}

export interface ResourceRecordBase {
  id: number;
  book_id: number;
  created_at: string;
  updated_at: string;
}

export interface OutlineView extends ResourceRecordBase {
  volume_no: number | null;
  volume_title: string | null;
  chapter_start_no: number | null;
  chapter_end_no: number | null;
  outline_level: string;
  title: string;
  story_core: string | null;
  main_plot: string | null;
  sub_plot: string | null;
  foreshadowing: string | null;
  expected_payoff: string | null;
  notes: string | null;
}

export interface WorldSettingView extends ResourceRecordBase {
  title: string;
  category: string;
  content: string;
  status: string;
  append_notes: string | null;
  keywords: string | null;
}

export interface CharacterView extends ResourceRecordBase {
  name: string;
  alias: string | null;
  gender: string | null;
  age: number | null;
  personality: string | null;
  background: string | null;
  current_location: string | null;
  status: string;
  professions: string | null;
  levels: string | null;
  currencies: string | null;
  abilities: string | null;
  goal: string | null;
  append_notes: string | null;
  keywords: string | null;
}

export interface FactionView extends ResourceRecordBase {
  name: string;
  category: string | null;
  core_goal: string | null;
  description: string | null;
  leader_character_id: number | null;
  headquarter: string | null;
  status: string | null;
  append_notes: string | null;
  keywords: string | null;
}

export interface RelationView extends ResourceRecordBase {
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  relation_type: string;
  intensity: number | null;
  status: string | null;
  description: string | null;
  append_notes: string | null;
  keywords: string | null;
}

export interface ItemView extends ResourceRecordBase {
  name: string;
  category: string | null;
  description: string | null;
  owner_type: string;
  owner_id: number | null;
  rarity: string | null;
  status: string | null;
  append_notes: string | null;
  keywords: string | null;
}

export interface StoryHookView extends ResourceRecordBase {
  title: string;
  hook_type: string | null;
  description: string | null;
  source_chapter_no: number | null;
  target_chapter_no: number | null;
  status: string;
  importance: string | null;
  append_notes: string | null;
  keywords: string | null;
}

export interface CreateOutlineInput {
  volumeNo?: number | null;
  volumeTitle?: string | null;
  chapterStartNo?: number | null;
  chapterEndNo?: number | null;
  outlineLevel: string;
  title: string;
  storyCore?: string | null;
  mainPlot?: string | null;
  subPlot?: string | null;
  foreshadowing?: string | null;
  expectedPayoff?: string | null;
  notes?: string | null;
}

export type UpdateOutlineInput = Partial<CreateOutlineInput>;

export interface CreateWorldSettingInput {
  title: string;
  category: string;
  content: string;
  status?: string;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateWorldSettingInput = Partial<CreateWorldSettingInput>;

export interface CreateCharacterInput {
  name: string;
  alias?: string | null;
  gender?: string | null;
  age?: number | null;
  personality?: string | null;
  background?: string | null;
  currentLocation?: string | null;
  status?: string;
  professions?: string | null;
  levels?: string | null;
  currencies?: string | null;
  abilities?: string | null;
  goal?: string | null;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateCharacterInput = Partial<CreateCharacterInput>;

export interface CreateFactionInput {
  name: string;
  category?: string | null;
  coreGoal?: string | null;
  description?: string | null;
  leaderCharacterId?: number | null;
  headquarter?: string | null;
  status?: string | null;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateFactionInput = Partial<CreateFactionInput>;

export interface CreateRelationInput {
  sourceType: string;
  sourceId: number;
  targetType: string;
  targetId: number;
  relationType: string;
  intensity?: number | null;
  status?: string | null;
  description?: string | null;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateRelationInput = Partial<CreateRelationInput>;

export interface CreateItemInput {
  name: string;
  category?: string | null;
  description?: string | null;
  ownerType?: string;
  ownerId?: number | null;
  rarity?: string | null;
  status?: string | null;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateItemInput = Partial<CreateItemInput>;

export interface CreateStoryHookInput {
  title: string;
  hookType?: string | null;
  description?: string | null;
  sourceChapterNo?: number | null;
  targetChapterNo?: number | null;
  status?: string;
  importance?: string | null;
  appendNotes?: string | null;
  keywords?: string | null;
}

export type UpdateStoryHookInput = Partial<CreateStoryHookInput>;

export interface MetaView {
  name: string;
  version: string;
  nodeEnv: string;
  llmProvider: string;
  webui: {
    enabled: boolean;
    distPath: string;
  };
}
