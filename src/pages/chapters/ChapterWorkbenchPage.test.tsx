import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as ReactRouter from "react-router-dom";
import { vi } from "vitest";

import * as chaptersApi from "@/lib/chapters-api";
import * as resourcesApi from "@/lib/resources-api";
import * as userSettingsApi from "@/lib/user-settings-api";
import * as workflowsApi from "@/lib/workflows-api";
import { ChapterWorkbenchPage } from "@/pages/chapters/ChapterWorkbenchPage";
import { renderWithRoute } from "@/test/utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe("ChapterWorkbenchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(ReactRouter.useParams).mockReturnValue({ bookId: "1", chapterNo: "2" });
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      hash: "",
      key: "default",
      pathname: "/app/books/1/chapters/2",
      search: "",
      state: null,
    });

    vi.spyOn(chaptersApi, "getChapter").mockResolvedValue({
      id: 2,
      chapter_no: 2,
      title: "黑铁令",
      status: "planned",
      actual_character_ids: null,
      actual_faction_ids: null,
      actual_item_ids: null,
      actual_hook_ids: null,
      actual_world_setting_ids: null,
    } as never);
    vi.spyOn(chaptersApi, "listChapters").mockResolvedValue([
      { id: 1, chapter_no: 1, title: "序章", status: "approved" },
      { id: 2, chapter_no: 2, title: "黑铁令", status: "planned" },
      { id: 3, chapter_no: 3, title: "入宗", status: "todo" },
    ] as never);
    vi.spyOn(chaptersApi, "getChapterWorkflowState").mockResolvedValue({
      status: "planned",
      hasPlan: true,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["draft"],
    } as never);
    vi.spyOn(chaptersApi, "getChapterStage").mockImplementation(async (_bookId, _chapterNo, stage) => ({
      content: `${stage} content`,
      summary: `${stage} summary`,
      metadata: { stage, wordCount: 10, updatedAt: "2026-05-10T00:00:00.000Z" },
    } as never));
    vi.spyOn(chaptersApi, "listChapterStageHistory").mockResolvedValue([
      {
        id: 501,
        versionNo: 2,
        isCurrent: true,
        summary: "第二版摘要",
        content: "第二版正文",
        wordCount: 22,
        updatedAt: "2026-05-11T10:00:00.000Z",
        metadata: {},
      },
      {
        id: 500,
        versionNo: 1,
        isCurrent: false,
        summary: "第一版摘要",
        content: "第一版正文",
        wordCount: 11,
        updatedAt: "2026-05-10T10:00:00.000Z",
        metadata: {},
      },
    ] as never);
    vi.spyOn(chaptersApi, "updateChapterStage").mockResolvedValue({ id: 2 } as never);

    vi.spyOn(resourcesApi, "listCharacters").mockResolvedValue([{ id: 11, name: "林夜", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listFactions").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listItems").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listRelations").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listStoryHooks").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listWorldSettings").mockResolvedValue([]);

    vi.spyOn(resourcesApi, "updateCharacter").mockResolvedValue({ id: 11, name: "林夜·新" } as never);
    vi.spyOn(resourcesApi, "updateFaction").mockResolvedValue({ id: 21, name: "青岳宗" } as never);
    vi.spyOn(resourcesApi, "updateItem").mockResolvedValue({ id: 31, name: "黑铁令" } as never);
    vi.spyOn(resourcesApi, "updateRelation").mockResolvedValue({ id: 41 } as never);
    vi.spyOn(resourcesApi, "updateStoryHook").mockResolvedValue({ id: 51, title: "黑铁令异常" } as never);
    vi.spyOn(resourcesApi, "updateWorldSetting").mockResolvedValue({ id: 61, title: "灵潮" } as never);

    vi.spyOn(workflowsApi, "generateStageSummary").mockResolvedValue({ summary: "生成的阶段摘要" } as never);
    vi.spyOn(workflowsApi, "generateAuthorIntent").mockResolvedValue({ authorIntent: "生成的意图草案" } as never);
    vi.spyOn(workflowsApi, "startAuthorIntentTask").mockResolvedValue({ id: 9000, workflowType: "author_intent", status: "pending", stage: "queued", progressPercent: null, error: null } as never);
    vi.spyOn(workflowsApi, "startPlanTask").mockResolvedValue({ id: 9001, workflowType: "plan", status: "pending", stage: "queued" } as never);
    vi.spyOn(workflowsApi, "startDraftTask").mockResolvedValue({ id: 9002, workflowType: "draft", status: "pending", stage: "queued" } as never);
    vi.spyOn(workflowsApi, "startReviewTask").mockResolvedValue({ id: 9003, workflowType: "review", status: "pending", stage: "queued" } as never);
    vi.spyOn(workflowsApi, "startRepairTask").mockResolvedValue({ id: 9004, workflowType: "repair", status: "pending", stage: "queued" } as never);
    vi.spyOn(workflowsApi, "startApproveTask").mockResolvedValue({ id: 9005, workflowType: "approve", status: "pending", stage: "queued" } as never);
    vi.spyOn(workflowsApi, "getLatestChapterWorkflowTask").mockResolvedValue(null as never);
    vi.spyOn(workflowsApi, "listChapterWorkflowTasks").mockResolvedValue([] as never);
    vi.spyOn(workflowsApi, "getWorkflowTask").mockResolvedValue({ id: 9001, workflowType: "plan", status: "pending", stage: "queued", progressPercent: null, error: null } as never);
    vi.spyOn(workflowsApi, "terminateWorkflowTask").mockResolvedValue({ id: 9001, workflowType: "plan", status: "terminating", stage: "queued", progressPercent: null, error: null } as never);
    vi.spyOn(workflowsApi, "runApprove").mockResolvedValue({ ok: true } as never);
  });

  it("shows current word count based on active stage content instead of shared metadata", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["repair", "approve"],
    } as never);
    vi.mocked(chaptersApi.getChapterStage).mockImplementation(async (_bookId, _chapterNo, stage) => {
      if (stage === "plan") {
        return {
          content: "甲乙丙丁",
          summary: "plan summary",
          metadata: { stage, wordCount: 3216, updatedAt: "2026-05-10T00:00:00.000Z" },
        } as never;
      }
      if (stage === "draft") {
        return {
          content: "一二三四五六",
          summary: "draft summary",
          metadata: { stage, wordCount: 3216, updatedAt: "2026-05-10T00:00:00.000Z" },
        } as never;
      }
      return {
        content: "天地玄黄宇宙洪荒",
        summary: "review summary",
        metadata: { stage, wordCount: 3216, updatedAt: "2026-05-10T00:00:00.000Z" },
      } as never;
    });

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("4 字")).toBeInTheDocument();
      expect(screen.getByText("当前字数")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    await waitFor(() => {
      expect(screen.getByText("6 字")).toBeInTheDocument();
      expect(screen.getByText("6")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    await waitFor(() => {
      expect(screen.getByText("8 字")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });
  });

  it("generates stage summary from current editor content without auto-saving", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("Workflow 参数")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("阶段正文内容")).toHaveValue("plan content");
      expect(screen.getByRole("button", { name: "AI 生成摘要" })).toBeEnabled();
    });

    const contentInput = screen.getByPlaceholderText("阶段正文内容");
    fireEvent.change(contentInput, { target: { value: "这是更新后的正文内容，用于生成阶段摘要。" } });

    await waitFor(() => {
      expect(contentInput).toHaveValue("这是更新后的正文内容，用于生成阶段摘要。");
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 生成摘要" }));

    await waitFor(() => {
      expect(workflowsApi.generateStageSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          stage: "plan",
          content: "这是更新后的正文内容，用于生成阶段摘要。",
          provider: "mock",
          lowModel: undefined,
          midModel: undefined,
          highModel: undefined,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("阶段摘要（可选）")).toHaveValue("生成的阶段摘要");
    });
    expect(chaptersApi.updateChapterStage).not.toHaveBeenCalled();
  });

  it("disables stage summary generation when editor content is empty", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("Workflow 参数")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("阶段正文内容"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "AI 生成摘要" })).toBeDisabled();
  });

  it("hides stage summary generation for review stage", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["repair", "approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "AI 生成摘要" })).not.toBeInTheDocument();
    });
  });

  it("restores workflow settings from localStorage after remount", async () => {
    const firstRender = renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("Workflow 参数")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    let dialog = await screen.findByRole("dialog", { name: "修改 workflow 参数" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "anthropic" } });
    fireEvent.change(within(dialog).getByPlaceholderText("可选 high 模型名"), { target: { value: "claude-opus-4-7" } });
    fireEvent.change(within(dialog).getByDisplayValue("3000"), { target: { value: "4500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存参数" }));

    await waitFor(() => {
      expect(screen.getByText("anthropic")).toBeInTheDocument();
      expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
      expect(screen.getByText("4500")).toBeInTheDocument();
    });

    firstRender.unmount();
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      hash: "",
      key: "after-remount",
      pathname: "/app/books/1/chapters/2",
      search: "",
      state: null,
    });

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("anthropic")).toBeInTheDocument();
      expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
      expect(screen.getByText("4500")).toBeInTheDocument();
    });
  });

  it("clears chapter model overrides back to user defaults", async () => {
    window.localStorage.setItem(
      "chapter-workbench-workflow-settings:1:2",
      JSON.stringify({
        provider: "anthropic",
        lowModel: "chapter-low-model",
        midModel: "chapter-mid-model",
        highModel: "chapter-high-model",
        targetWords: "4500",
      }),
    );
    vi.spyOn(userSettingsApi, "getUserRuntimeSettings").mockResolvedValue({
      overrides: {},
      serverDefaults: {
        provider: "mock",
        model: "deepseek-v4-pro",
        lowModel: "deepseek-v4-flash",
        midModel: "deepseek-v4-pro",
        highModel: "deepseek-v4-max",
        defaultMaxTokens: 8000,
        openaiApiKey: { hasValue: false, maskedValue: null },
        anthropicApiKey: { hasValue: false, maskedValue: null },
        customLlmApiKey: { hasValue: false, maskedValue: null },
      },
      effective: {
        provider: "mock",
        model: "deepseek-v4-pro",
        lowModel: "deepseek-v4-flash",
        midModel: "deepseek-v4-pro",
        highModel: "deepseek-v4-max",
        defaultMaxTokens: 8000,
        openaiApiKey: { hasValue: false, maskedValue: null },
        anthropicApiKey: { hasValue: false, maskedValue: null },
        customLlmApiKey: { hasValue: false, maskedValue: null },
      },
      capabilities: {
        allowedProviders: ["mock", "openai", "anthropic", "custom"],
        providerAvailability: { mock: true, openai: true, anthropic: true, custom: true },
        supportsSensitiveOverrides: true,
      },
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("chapter-low-model")).toBeInTheDocument();
      expect(screen.getByText("chapter-mid-model")).toBeInTheDocument();
      expect(screen.getByText("chapter-high-model")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清除模型覆盖" }));

    await waitFor(() => {
      expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
      expect(screen.getByText("deepseek-v4-pro")).toBeInTheDocument();
      expect(screen.getByText("deepseek-v4-max")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("chapter-workbench-workflow-settings:1:2")).toBe(
      JSON.stringify({
        provider: "mock",
        lowModel: "deepseek-v4-flash",
        midModel: "deepseek-v4-pro",
        highModel: "deepseek-v4-max",
        targetWords: "3000",
      }),
    );
  });

  it("ignores legacy single-model workflow settings from localStorage", async () => {
    window.localStorage.setItem(
      "chapter-workbench-workflow-settings:1:2",
      JSON.stringify({
        provider: "anthropic",
        model: "legacy-single-model",
        targetWords: "4100",
      }),
    );
    vi.spyOn(userSettingsApi, "getUserRuntimeSettings").mockResolvedValue({
      overrides: {},
      serverDefaults: {
        provider: "mock",
        model: "deepseek-v4-pro",
        lowModel: "deepseek-v4-flash",
        midModel: "deepseek-v4-pro",
        highModel: "deepseek-v4-max",
        defaultMaxTokens: 8000,
        openaiApiKey: { hasValue: false, maskedValue: null },
        anthropicApiKey: { hasValue: false, maskedValue: null },
        customLlmApiKey: { hasValue: false, maskedValue: null },
      },
      effective: {
        provider: "mock",
        model: "deepseek-v4-pro",
        lowModel: "deepseek-v4-flash",
        midModel: "deepseek-v4-pro",
        highModel: "deepseek-v4-max",
        defaultMaxTokens: 8000,
        openaiApiKey: { hasValue: false, maskedValue: null },
        anthropicApiKey: { hasValue: false, maskedValue: null },
        customLlmApiKey: { hasValue: false, maskedValue: null },
      },
      capabilities: {
        allowedProviders: ["mock", "openai", "anthropic", "custom"],
        providerAvailability: { mock: true, openai: true, anthropic: true, custom: true },
        supportsSensitiveOverrides: true,
      },
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("anthropic")).toBeInTheDocument();
      expect(screen.getByText("4100")).toBeInTheDocument();
      expect(screen.queryByText("legacy-single-model")).not.toBeInTheDocument();
      expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
      expect(screen.getByText("deepseek-v4-pro")).toBeInTheDocument();
      expect(screen.getByText("deepseek-v4-max")).toBeInTheDocument();
    });
  });

  it("prefills workflow settings from location state", async () => {
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      hash: "",
      key: "preset",
      pathname: "/app/books/1/chapters/2",
      search: "",
      state: {
        provider: "anthropic",
        highModel: "claude-opus-4-7",
      },
    });

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("Workflow 参数")).toBeInTheDocument();
    });

    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    const dialog = await screen.findByRole("dialog", { name: "修改 workflow 参数" });
    expect(within(dialog).getByDisplayValue("anthropic")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("claude-opus-4-7")).toBeInTheDocument();
  });

  it("shows stage-local workflow actions only", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("状态：planned")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "生成 draft" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "repair" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "approve dryRun" })).not.toBeInTheDocument();
  });

  it("renders merged version history details and keeps full content collapsed until expanded", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "版本历史" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "历史详情" })).not.toBeInTheDocument();
      expect(screen.getByText("full content")).toBeInTheDocument();
      expect(screen.getByText("summary")).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog", { name: "版本差异对比" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看差异" })).not.toBeInTheDocument();
    expect(screen.queryByText("当前还没有可比较的历史版本。")).not.toBeInTheDocument();
    expect(screen.queryByText("版本号")).not.toBeInTheDocument();
    expect(screen.queryByText("当前版本")).not.toBeInTheDocument();

    expect(screen.queryByText("第二版正文")).not.toBeInTheDocument();
    const fullContentHeader = screen.getByText("full content").parentElement;
    expect(fullContentHeader).not.toBeNull();
    fireEvent.click(within(fullContentHeader as HTMLElement).getByRole("button", { name: "展开正文" }));

    await waitFor(() => {
      expect(screen.getByText("第二版正文")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /v1/i }));

    await waitFor(() => {
      expect(screen.queryByText("第一版正文")).not.toBeInTheDocument();
    });
  });

  it("shows diff dialog only after clicking view diff for a selected comparison pair", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "版本历史" })).toBeInTheDocument();
    });

    const compareV2 = await screen.findByRole("checkbox", { name: "对比 v2" });
    fireEvent.click(compareV2);

    expect(screen.queryByRole("dialog", { name: "版本差异对比" })).not.toBeInTheDocument();
    expect(screen.getByText("再勾选一个版本即可比较。")).toBeInTheDocument();

    const compareV1 = await screen.findByRole("checkbox", { name: "对比 v1" });
    fireEvent.click(compareV1);

    expect(screen.queryByRole("dialog", { name: "版本差异对比" })).not.toBeInTheDocument();
    const viewDiffButton = screen.getByRole("button", { name: "查看差异" });
    expect(viewDiffButton).toBeInTheDocument();

    fireEvent.click(viewDiffButton);

    const dialog = await screen.findByRole("dialog", { name: "版本差异对比" });
    expect(within(dialog).getByText("对比 v1 → v2")).toBeInTheDocument();
    expect(within(dialog).getByText(/第二版正文/)).toBeInTheDocument();
    expect(within(dialog).getByText(/第一版正文/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getAllByRole("button", { name: "关闭" })[0]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "版本差异对比" })).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "查看差异" })).toBeInTheDocument();
  });

  it("sorts chapter navigation by chapter number", async () => {
    vi.mocked(chaptersApi.listChapters).mockResolvedValue([
      { id: 3, chapter_no: 3, title: "入宗", status: "todo" },
      { id: 1, chapter_no: 1, title: "序章", status: "approved" },
      { id: 2, chapter_no: 2, title: "黑铁令", status: "planned" },
    ] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("状态：planned")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "上一章 · 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一章 · 3" })).toBeEnabled();
  });

  it("edits workflow settings through dialog and uses plan intent dialog for initial plan", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("Workflow 参数")).toBeInTheDocument();
    });

    expect(screen.getByText("mock")).toBeInTheDocument();
    expect(screen.getAllByText("3000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未设置").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "修改" }));

    let dialog = await screen.findByRole("dialog", { name: "修改 workflow 参数" });
    fireEvent.change(within(dialog).getByDisplayValue("3000"), { target: { value: "4500" } });
    fireEvent.change(within(dialog).getByPlaceholderText("可选 high 模型名"), { target: { value: "claude-opus-4-7" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "修改 workflow 参数" })).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("3000").length).toBeGreaterThan(0);
    expect(screen.queryByText("claude-opus-4-7")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    dialog = await screen.findByRole("dialog", { name: "修改 workflow 参数" });
    fireEvent.change(within(dialog).getByDisplayValue("3000"), { target: { value: "4500" } });
    fireEvent.change(within(dialog).getByPlaceholderText("可选 high 模型名"), { target: { value: "claude-opus-4-7" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存参数" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "修改 workflow 参数" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
    expect(screen.getByText("4500")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "生成 plan" }));

    const planDialog = await screen.findByRole("dialog", { name: "生成 plan" });
    fireEvent.change(within(planDialog).getByLabelText("本次 plan 意图"), { target: { value: "强化主角试炼线" } });
    fireEvent.click(within(planDialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          provider: "mock",
          lowModel: "deepseek-v4-flash",
          midModel: "deepseek-v4-pro",
          highModel: "claude-opus-4-7",
          targetWords: 4500,
          authorIntent: "强化主角试炼线",
        }),
      );
    });
  });

  it("preselects chapter-linked resources in manualEntityRefs without highlight badges", async () => {
    vi.mocked(chaptersApi.getChapter).mockResolvedValue({
      id: 2,
      chapter_no: 2,
      title: "黑铁令",
      status: "planned",
      actual_character_ids: "[11]",
      actual_faction_ids: null,
      actual_item_ids: null,
      actual_hook_ids: null,
      actual_world_setting_ids: null,
    } as never);
    vi.mocked(ReactRouter.useLocation).mockImplementation(() => ({
      hash: "",
      key: String(Math.random()),
      pathname: "/app/books/1/chapters/2",
      search: "",
      state: null,
    }));

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /林夜/ })).toBeChecked();
    });

    expect(screen.queryByText("章节已关联")).not.toBeInTheDocument();
  });

  it("shows manualEntityRefs summary in plan dialog and passes selected refs to workflow", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /林夜/ })).toBeInTheDocument();
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /林夜/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "生成 plan" });
    expect(within(dialog).getByText("本次带入的 manualEntityRefs")).toBeInTheDocument();
    expect(within(dialog).getByText("角色 1")).toBeInTheDocument();
    expect(within(dialog).getByText("势力 0")).toBeInTheDocument();
    expect(within(dialog).getByText("物品 0")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          authorIntent: undefined,
          manualEntityRefs: expect.objectContaining({
            characterIds: [11],
          }),
        }),
      );
    });
  });

  it("supports expanded selector search pagination and synced selection", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(resourcesApi.listCharacters).mockResolvedValue([
      { id: 11, name: "林夜壹", status: "active" },
      { id: 12, name: "林夜贰", status: "active" },
      { id: 13, name: "林夜叁", status: "active" },
      { id: 14, name: "林夜肆", status: "active" },
      { id: 15, name: "林夜伍", status: "active" },
      { id: 16, name: "林夜陆", status: "active" },
      { id: 17, name: "林夜柒", status: "active" },
      { id: 18, name: "林夜捌", status: "active" },
      { id: 19, name: "林夜玖", status: "active" },
    ] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "角色选择器" });
    expect(within(dialog).getByText("第 1 / 2 页")).toBeInTheDocument();
    expect(within(dialog).queryByText("林夜玖")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      expect(within(dialog).getByText("第 2 / 2 页")).toBeInTheDocument();
    });
    expect(within(dialog).getByText("林夜玖")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText("搜索角色名称"), { target: { value: "贰" } });
    await waitFor(() => {
      expect(within(dialog).getByText("第 1 / 1 页")).toBeInTheDocument();
    });
    expect(within(dialog).getByText("林夜贰")).toBeInTheDocument();
    expect(within(dialog).queryByText("林夜玖")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "选择林夜贰" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "角色选择器" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 plan" }));
    const planDialog = await screen.findByRole("dialog", { name: "生成 plan" });
    fireEvent.click(within(planDialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          manualEntityRefs: expect.objectContaining({
            characterIds: [12],
          }),
        }),
      );
    });
  });

  it("opens resource editor from expanded selector and saves character changes", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[0]);
    const selectorDialog = await screen.findByRole("dialog", { name: "角色选择器" });
    fireEvent.click(within(selectorDialog).getByRole("button", { name: "修改林夜" }));

    const editorDialog = await screen.findByRole("dialog", { name: "修改实体" });
    fireEvent.change(within(editorDialog).getByRole("textbox", { name: "姓名" }), { target: { value: "林夜·新" } });
    fireEvent.click(within(editorDialog).getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(resourcesApi.updateCharacter).toHaveBeenCalledWith(
        1,
        11,
        expect.objectContaining({
          name: "林夜·新",
        }),
      );
    });
  });

  it("uses enum select for relation type in chapter resource editor", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(resourcesApi.listRelations).mockResolvedValue([
      {
        id: 41,
        source_type: "character",
        source_id: 11,
        target_type: "faction",
        target_id: 21,
        relation_type: "member",
        status: "active",
        description: "旧关系",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[4]);
    const selectorDialog = await screen.findByRole("dialog", { name: "关系选择器" });
    fireEvent.click(within(selectorDialog).getByRole("button", { name: /修改character:11/ }));

    const editorDialog = await screen.findByRole("dialog", { name: "修改实体" });
    const relationTypeSelect = within(editorDialog).getByRole("combobox", { name: "关系类型" });
    const relationStatusSelect = within(editorDialog).getByRole("combobox", { name: "状态" });
    expect(relationTypeSelect).toHaveValue("member");
    expect(relationStatusSelect).toHaveValue("active");
    expect(within(relationTypeSelect).getByRole("option", { name: "导师" })).toBeInTheDocument();
    expect(within(relationTypeSelect).getByRole("option", { name: "普通朋友" })).toBeInTheDocument();
    expect(within(relationTypeSelect).getByRole("option", { name: "挚友" })).toBeInTheDocument();
    expect(within(relationTypeSelect).getByRole("option", { name: "生死之交" })).toBeInTheDocument();
    expect(within(relationTypeSelect).getByRole("option", { name: "情侣" })).toBeInTheDocument();
    expect(within(relationTypeSelect).getByRole("option", { name: "夫妻" })).toBeInTheDocument();
    expect(within(relationStatusSelect).getByRole("option", { name: "启用" })).toBeInTheDocument();
    expect(within(relationStatusSelect).getByRole("option", { name: "断裂" })).toBeInTheDocument();
  });



  it("shows relation entity names alongside relation ids in selector", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(resourcesApi.listRelations).mockResolvedValue([
      {
        id: 41,
        source_type: "character",
        source_id: 11,
        target_type: "faction",
        target_id: 21,
        relation_type: "member",
        status: "active",
        description: "旧关系",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);
    vi.mocked(resourcesApi.listFactions).mockResolvedValue([{ id: 21, name: "青岳宗", status: "active" } as never]);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[4]);
    const selectorDialog = await screen.findByRole("dialog", { name: "关系选择器" });
    expect(within(selectorDialog).getByText("character:11 → faction:21")).toBeInTheDocument();
    expect(within(selectorDialog).getByText(/林夜 → 青岳宗/)).toBeInTheDocument();
  });


  it("shows localized relation entity type options in chapter resource editor", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(resourcesApi.listRelations).mockResolvedValue([
      {
        id: 41,
        source_type: "character",
        source_id: 11,
        target_type: "faction",
        target_id: 21,
        relation_type: "member",
        status: "active",
        description: "旧关系",
        created_at: "2026-05-10T00:00:00.000Z",
        updated_at: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);
    vi.mocked(resourcesApi.listItems).mockResolvedValue([{ id: 31, name: "黑铁令", status: "active" } as never]);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[4]);
    const selectorDialog = await screen.findByRole("dialog", { name: "关系选择器" });
    fireEvent.click(within(selectorDialog).getByRole("button", { name: /修改character:11/ }));

    const editorDialog = await screen.findByRole("dialog", { name: "修改实体" });
    const sourceTypeSelect = within(editorDialog).getByRole("combobox", { name: "起点类型" });
    const targetTypeSelect = within(editorDialog).getByRole("combobox", { name: "终点类型" });
    expect(within(sourceTypeSelect).getByRole("option", { name: "角色" })).toBeInTheDocument();
    expect(within(targetTypeSelect).getByRole("option", { name: "势力" })).toBeInTheDocument();

    fireEvent.change(sourceTypeSelect, { target: { value: "item" } });

    const sourceSelect = within(editorDialog).getByRole("combobox", { name: "起点实体" }) as HTMLSelectElement;
    expect(sourceSelect.value).toBe("");
    expect(within(editorDialog).getByRole("option", { name: "黑铁令" })).toBeInTheDocument();
  });


  it("shows faction leader options in chapter resource editor", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(resourcesApi.listFactions).mockResolvedValue([
      { id: 21, name: "青岳宗", status: "active", leader_character_id: null } as never,
    ]);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByText("manualEntityRefs 选择器")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "展开" })[1]);
    const selectorDialog = await screen.findByRole("dialog", { name: "势力选择器" });
    fireEvent.click(within(selectorDialog).getByRole("button", { name: "修改青岳宗" }));

    const editorDialog = await screen.findByRole("dialog", { name: "修改实体" });
    expect(within(editorDialog).getByRole("option", { name: "林夜" })).toBeInTheDocument();
  });

  it("generates authorIntent into initial plan dialog and confirms with generated text", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9000,
      workflowType: "author_intent",
      status: "succeeded",
      stage: "generating_author_intent",
      progressPercent: 100,
      error: null,
      result: { authorIntent: "生成的意图草案" },
      bookId: 1,
      chapterNo: 2,
      updatedAt: new Date().toISOString(),
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "生成 plan" });
    expect(within(dialog).getByRole("button", { name: "生成 authorIntent" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "生成 authorIntent" }));

    await waitFor(() => {
      expect(workflowsApi.startAuthorIntentTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          provider: "mock",
          lowModel: "deepseek-v4-flash",
          midModel: "deepseek-v4-pro",
          highModel: "deepseek-v4-max",
          manualEntityRefs: expect.objectContaining({
            characterIds: [],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect((within(dialog).getByLabelText("本次 plan 意图") as HTMLTextAreaElement).value).toBe("生成的意图草案");
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          authorIntent: "生成的意图草案",
        }),
      );
    });
  });

  it("shows manualEntityRefs summary and passes refs to authorIntent generation in replan dialog", async () => {
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9000,
      workflowType: "author_intent",
      status: "succeeded",
      stage: "generating_author_intent",
      progressPercent: 100,
      error: null,
      result: { authorIntent: "生成的意图草案" },
      bookId: 1,
      chapterNo: 2,
      updatedAt: new Date().toISOString(),
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /林夜/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "重新 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /林夜/ }));
    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    expect(within(dialog).getByText("本次带入的 manualEntityRefs")).toBeInTheDocument();
    expect(within(dialog).getByText("角色 1")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "生成 authorIntent" }));

    await waitFor(() => {
      expect(workflowsApi.startAuthorIntentTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          manualEntityRefs: expect.objectContaining({
            characterIds: [11],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect((within(dialog).getByLabelText("本次重新 plan 意图") as HTMLTextAreaElement).value).toBe("生成的意图草案");
    });
  });

  it("shows loading state while generating authorIntent", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "todo",
      hasPlan: false,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: null,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["plan"],
    } as never);
    vi.mocked(workflowsApi.startAuthorIntentTask).mockResolvedValue({
      id: 9000,
      workflowType: "author_intent",
      status: "pending",
      stage: "queued",
      progressPercent: null,
      error: null,
      bookId: 1,
      chapterNo: 2,
      updatedAt: new Date().toISOString(),
    } as never);
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9000,
      workflowType: "author_intent",
      status: "running",
      stage: "generating_author_intent",
      progressPercent: 80,
      error: null,
      result: null,
      bookId: 1,
      chapterNo: 2,
      updatedAt: new Date().toISOString(),
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "生成 plan" });
    fireEvent.click(within(dialog).getByRole("button", { name: "生成 authorIntent" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "生成 authorIntent 中..." })).toBeDisabled();
      expect(within(dialog).getByText("执行中 · 生成作者意图")).toBeInTheDocument();
      expect(within(dialog).getByText(/任务 #9000 · 80%/)).toBeInTheDocument();
    });
  });

  it("triggers draft workflow from the plan action area", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "planned",
      hasPlan: true,
      hasDraft: false,
      hasReview: false,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: null,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["draft"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成 draft" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 draft" }));

    await waitFor(() => {
      expect(workflowsApi.startDraftTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
        }),
      );
    });
  });

  it("triggers review workflow from the draft action area", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "drafted",
      hasPlan: true,
      hasDraft: true,
      hasReview: false,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: null,
      currentFinalId: null,
      availableActions: ["review"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成 review" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 review" }));

    await waitFor(() => {
      expect(workflowsApi.startReviewTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
        }),
      );
    });
  });

  it("triggers repair workflow from the review action area", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["repair", "approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成 repair" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成 repair" }));

    await waitFor(() => {
      expect(workflowsApi.startRepairTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
        }),
      );
    });
  });

  it("triggers approve workflow from the review action area", async () => {
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["repair", "approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));

    await waitFor(() => {
      expect(workflowsApi.startApproveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          dryRun: undefined,
        }),
      );
    });
  });

  it("opens replan dialog before rerunning plan", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    expect(within(dialog).getByLabelText("本次重新 plan 意图")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "确定" })).toBeInTheDocument();
    expect(workflowsApi.startPlanTask).not.toHaveBeenCalled();
  });

  it("passes dialog authorIntent when confirming replan", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));

    const dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    fireEvent.change(within(dialog).getByLabelText("本次重新 plan 意图"), { target: { value: "强化宗门旧案线索" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          authorIntent: "强化宗门旧案线索",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "重新 plan" })).not.toBeInTheDocument();
    });
  });

  it("allows empty authorIntent in replan dialog", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));
    const dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(workflowsApi.startPlanTask).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 1,
          chapterNo: 2,
          authorIntent: undefined,
        }),
      );
    });
  });

  it("cancels replan dialog without firing workflow and clears temporary input", async () => {
    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新 plan" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));
    let dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    fireEvent.change(within(dialog).getByLabelText("本次重新 plan 意图"), { target: { value: "临时意图" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "重新 plan" })).not.toBeInTheDocument();
    });
    expect(workflowsApi.startPlanTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "重新 plan" }));
    dialog = await screen.findByRole("dialog", { name: "重新 plan" });
    expect((within(dialog).getByLabelText("本次重新 plan 意图") as HTMLTextAreaElement).value).toBe("");
  });

  it("shows approve task status card while running", async () => {
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9005,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "running",
      stage: "queued",
      progressPercent: null,
      startedAt: null,
      finishedAt: null,
      currentPlanId: null,
      currentDraftId: null,
      result: null,
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    } as never);
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 正在执行")).toBeInTheDocument();
      expect(screen.getByText("当前阶段：任务排队中")).toBeInTheDocument();
    });
  });

  it("shows a running workflow status card with stage and progress", async () => {
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9005,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "running",
      stage: "updating_resources",
      progressPercent: 72,
      startedAt: "2026-05-10T00:00:00.000Z",
      finishedAt: null,
      currentPlanId: 101,
      currentDraftId: 102,
      result: null,
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    } as never);
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 正在执行")).toBeInTheDocument();
      expect(screen.getByText("当前阶段：更新资源实体")).toBeInTheDocument();
      expect(screen.getByText("72%")).toBeInTheDocument();
      expect(screen.getByText("任务 #9005")).toBeInTheDocument();
      expect(screen.getByText("Plan #101")).toBeInTheDocument();
      expect(screen.getByText("Draft #102")).toBeInTheDocument();
    });
  });

  it("keeps the latest completed workflow task visible after success", async () => {
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9005,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "succeeded",
      stage: "saving_artifacts",
      progressPercent: 100,
      startedAt: "2026-05-10T00:00:00.000Z",
      finishedAt: "2026-05-10T00:03:00.000Z",
      currentPlanId: 101,
      currentDraftId: 102,
      result: { finalId: 104 },
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:03:00.000Z",
    } as never);
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 已完成")).toBeInTheDocument();
      expect(screen.getByText("最近一次任务已完成，当前阶段停留在：保存阶段产物")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getByText("Final #104")).toBeInTheDocument();
    });
  });

  it("shows approve task status card while running", async () => {
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9005,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "running",
      stage: "queued",
      progressPercent: null,
      startedAt: null,
      finishedAt: null,
      currentPlanId: null,
      currentDraftId: null,
      result: null,
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    } as never);
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 正在执行")).toBeInTheDocument();
      expect(screen.getByText("当前阶段：任务排队中")).toBeInTheDocument();
    });
  });

  it("refetches task history when switching to task tab", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(workflowsApi.listChapterWorkflowTasks).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(workflowsApi.listChapterWorkflowTasks).toHaveBeenCalledTimes(2);
    });
  });

  it("shows terminate action for a running task and submits terminate request", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([
      {
        id: 9302,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "approve",
        status: "running",
        stage: "updating_resources",
        progressPercent: 72,
        startedAt: "2026-05-10T00:00:00.000Z",
        finishedAt: null,
        currentPlanId: 101,
        currentDraftId: 102,
        result: null,
        error: null,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:02:00.000Z",
      },
    ] as never);
    vi.mocked(workflowsApi.terminateWorkflowTask).mockResolvedValue({
      id: 9302,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "terminating",
      stage: "updating_resources",
      progressPercent: 72,
      startedAt: "2026-05-10T00:00:00.000Z",
      finishedAt: null,
      currentPlanId: 101,
      currentDraftId: 102,
      result: null,
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:02:00.000Z",
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    const terminateButton = await screen.findByRole("button", { name: "终止任务" });
    fireEvent.click(terminateButton);

    await waitFor(() => {
      expect(workflowsApi.terminateWorkflowTask).toHaveBeenCalledWith(9302);
    });
  });

  it("shows terminating task state with a disabled terminate button", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([
      {
        id: 9303,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "approve",
        status: "terminating",
        stage: "updating_resources",
        progressPercent: 72,
        startedAt: "2026-05-10T00:00:00.000Z",
        finishedAt: null,
        currentPlanId: 101,
        currentDraftId: 102,
        result: null,
        error: { code: "terminated_by_user", message: "Task terminated by user", details: null },
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:02:00.000Z",
      },
    ] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 正在终止")).toBeInTheDocument();
      expect(screen.getByText("终止请求已提交，当前阶段：更新资源实体")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "终止中..." })).toBeDisabled();
    });
  });

  it("shows terminated task state without running feedback styling", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([
      {
        id: 9304,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "approve",
        status: "terminated",
        stage: "updating_resources",
        progressPercent: 72,
        startedAt: "2026-05-10T00:00:00.000Z",
        finishedAt: "2026-05-10T00:03:00.000Z",
        currentPlanId: 101,
        currentDraftId: 102,
        result: null,
        error: { code: "terminated_by_user", message: "Task terminated by user", details: null },
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:03:00.000Z",
      },
    ] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 已终止")).toBeInTheDocument();
      expect(screen.getByText("Task terminated by user")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "终止任务" })).not.toBeInTheDocument();
    });
  });

  it("shows task tab empty state", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Task 历史" })).toBeInTheDocument();
      expect(screen.getByText("当前章节还没有 workflow task 记录。")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("阶段正文内容")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "版本历史" })).not.toBeInTheDocument();
    });
  });

  it("shows task history list and switches task detail", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([
      {
        id: 9202,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "draft",
        status: "failed",
        stage: "generating_draft",
        progressPercent: 48,
        startedAt: "2026-05-10T00:00:00.000Z",
        finishedAt: "2026-05-10T00:02:00.000Z",
        currentPlanId: 101,
        currentDraftId: null,
        result: null,
        error: { code: "draft_failed", message: "生成 draft 失败", details: { reason: "mock" } },
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:02:00.000Z",
      },
      {
        id: 9201,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "plan",
        status: "succeeded",
        stage: "saving_artifacts",
        progressPercent: 100,
        startedAt: "2026-05-09T00:00:00.000Z",
        finishedAt: "2026-05-09T00:03:00.000Z",
        currentPlanId: 101,
        currentDraftId: null,
        result: { planId: 101 },
        error: null,
        createdAt: "2026-05-09T00:00:00.000Z",
        updatedAt: "2026-05-09T00:03:00.000Z",
      },
    ] as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(screen.getByText("Draft 执行失败")).toBeInTheDocument();
      expect(screen.getByText("生成 draft 失败")).toBeInTheDocument();
      expect(screen.getAllByText("48%").length).toBeGreaterThan(0);
      expect(screen.getAllByText("任务 #9202").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /Plan · 任务 #9201/ }));

    await waitFor(() => {
      expect(screen.getByText("Plan 已完成")).toBeInTheDocument();
      expect(screen.getAllByText(/Plan #101/).length).toBeGreaterThan(0);
      expect(screen.getByText(/"planId": 101/)).toBeInTheDocument();
    });
  });

  it("prefers running workflow task in task tab detail", async () => {
    vi.mocked(workflowsApi.listChapterWorkflowTasks).mockResolvedValue([
      {
        id: 9301,
        bookId: 1,
        chapterId: 2,
        chapterNo: 2,
        workflowType: "approve",
        status: "running",
        stage: "updating_resources",
        progressPercent: 72,
        startedAt: "2026-05-10T00:00:00.000Z",
        finishedAt: null,
        currentPlanId: 101,
        currentDraftId: 102,
        result: null,
        error: null,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:02:00.000Z",
      },
    ] as never);
    vi.mocked(workflowsApi.getWorkflowTask).mockResolvedValue({
      id: 9301,
      bookId: 1,
      chapterId: 2,
      chapterNo: 2,
      workflowType: "approve",
      status: "running",
      stage: "updating_resources",
      progressPercent: 72,
      startedAt: "2026-05-10T00:00:00.000Z",
      finishedAt: null,
      currentPlanId: 101,
      currentDraftId: 102,
      result: null,
      error: null,
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:02:00.000Z",
    } as never);
    vi.mocked(chaptersApi.getChapterWorkflowState).mockResolvedValue({
      status: "reviewed",
      hasPlan: true,
      hasDraft: true,
      hasReview: true,
      hasFinal: false,
      currentPlanId: 101,
      currentDraftId: 102,
      currentReviewId: 103,
      currentFinalId: null,
      availableActions: ["approve"],
    } as never);

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "批准成稿" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "批准成稿" }));
    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    await waitFor(() => {
      expect(screen.getByText("Approve 正在执行")).toBeInTheDocument();
      expect(screen.getByText("当前阶段：更新资源实体")).toBeInTheDocument();
      expect(screen.getAllByText("72%").length).toBeGreaterThan(0);
    });
  });

  it("updates history when changing history limit and preserves inline details", async () => {
    vi.mocked(chaptersApi.listChapterStageHistory).mockImplementation(async (_bookId, _chapterNo, stage, limit) => {
      if (stage !== "plan") {
        return [] as never;
      }
      return [
        {
          id: (limit ?? 20) * 10 + 1,
          versionNo: 3,
          stage,
          summary: `summary-${limit}-3`,
          content: `current-${limit}\nnew line`,
          wordCount: 1200,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z",
          isCurrent: true,
        },
        {
          id: (limit ?? 20) * 10 + 2,
          versionNo: 2,
          stage,
          summary: `summary-${limit}-2`,
          content: `previous-${limit}`,
          wordCount: 900,
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z",
          isCurrent: false,
        },
      ] as never;
    });

    renderWithRoute(<ChapterWorkbenchPage />, "/app/books/1/chapters/2", "/app/books/:bookId/chapters/:chapterNo");

    await waitFor(() => {
      expect(screen.getAllByText("summary-10-3").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /v2/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "版本历史" })).toBeInTheDocument();
      expect(screen.queryByText("History Detail")).not.toBeInTheDocument();
      expect(screen.getAllByText("summary-10-2").length).toBeGreaterThan(0);
      expect(screen.queryByText("previous-10")).not.toBeInTheDocument();
      expect(screen.getAllByText("v2").length).toBeGreaterThan(0);
    });

    const fullContentHeader = screen.getByText("full content").parentElement;
    expect(fullContentHeader).not.toBeNull();
    fireEvent.click(within(fullContentHeader as HTMLElement).getByRole("button", { name: "展开正文" }));

    await waitFor(() => {
      expect(screen.getByText("previous-10")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("history limit"), { target: { value: "20" } });

    await waitFor(() => {
      expect(chaptersApi.listChapterStageHistory).toHaveBeenCalledWith(1, 2, "plan", 20);
      expect(screen.getAllByText("summary-20-3").length).toBeGreaterThan(0);
    });
  });
});
