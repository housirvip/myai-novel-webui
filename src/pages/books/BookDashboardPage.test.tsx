import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as ReactRouter from "react-router-dom";
import { vi } from "vitest";

import { BookDashboardPage } from "@/pages/books/BookDashboardPage";
import * as booksApi from "@/lib/books-api";
import * as chaptersApi from "@/lib/chapters-api";
import * as resourcesApi from "@/lib/resources-api";
import { renderWithRoute } from "@/test/utils";
import * as userSettingsApi from "@/lib/user-settings-api";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: vi.fn(),
  };
});

describe("BookDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReactRouter.useParams).mockReturnValue({ bookId: "1" });
    vi.stubGlobal("confirm", vi.fn(() => true));

    vi.spyOn(booksApi, "getBook").mockResolvedValue({
      id: 1,
      title: "青岳入门录",
      summary: "少年持令入宗。",
      targetChapterCount: 100,
      currentChapterCount: 2,
      status: "drafting",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    } as never);
    vi.spyOn(booksApi, "updateBook").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(booksApi, "deleteBook").mockResolvedValue({ ok: true } as never);

    vi.spyOn(chaptersApi, "listChapters").mockResolvedValue([
      {
        id: 1,
        chapterNo: 1,
        title: "序章",
        summary: "开局",
        status: "approved",
        currentPlanId: 10,
        currentDraftId: 11,
        currentReviewId: 12,
        currentFinalId: 13,
        actualCharacterIds: "11",
        actualFactionIds: null,
        actualItemIds: null,
        actualHookIds: null,
        actualWorldSettingIds: null,
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      {
        id: 2,
        chapterNo: 2,
        title: "黑铁令",
        summary: "入宗",
        status: "planned",
        currentPlanId: 21,
        currentDraftId: null,
        currentReviewId: null,
        currentFinalId: null,
        actualCharacterIds: null,
        actualFactionIds: null,
        actualItemIds: null,
        actualHookIds: null,
        actualWorldSettingIds: null,
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
    ] as never);
    vi.spyOn(chaptersApi, "createChapter").mockResolvedValue({ chapterNo: 3 } as never);
    vi.spyOn(chaptersApi, "updateChapter").mockResolvedValue({ id: 2 } as never);
    vi.spyOn(chaptersApi, "deleteChapter").mockResolvedValue({ ok: true } as never);

    vi.spyOn(resourcesApi, "listCharacters").mockResolvedValue([{ id: 11, name: "林夜", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listFactions").mockResolvedValue([{ id: 21, name: "青岳宗", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listItems").mockResolvedValue([{ id: 31, name: "黑铁令", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listStoryHooks").mockResolvedValue([{ id: 41, title: "令牌异常", status: "open" } as never]);
    vi.spyOn(resourcesApi, "listWorldSettings").mockResolvedValue([{ id: 51, title: "外门制度", category: "rule" } as never]);
    vi.spyOn(userSettingsApi, "getUserRuntimeSettings").mockResolvedValue({
      overrides: {},
      serverDefaults: {
        provider: "mock",
        model: "deepseek-v4-pro",
        lowModel: "deepseek-v4-lite",
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
        lowModel: "deepseek-v4-lite",
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
  });

  it("hydrates model tiers from saved user runtime settings", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getByLabelText("Low Model")).toHaveValue("deepseek-v4-lite");
      expect(screen.getByLabelText("Mid Model")).toHaveValue("deepseek-v4-pro");
      expect(screen.getByLabelText("High Model")).toHaveValue("deepseek-v4-max");
    });
  });

  it("updates book metadata", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getByDisplayValue("青岳入门录")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("书籍标题"), { target: { value: "青岳入门录·修订" } });
    fireEvent.change(screen.getByLabelText("目标章节数"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "保存书籍信息" }));

    await waitFor(() => {
      expect(booksApi.updateBook).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: "青岳入门录·修订",
          targetChapterCount: 120,
        }),
      );
    });
  });

  it("deletes the current book and navigates back to app", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "删除书籍" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "删除书籍" }));

    await waitFor(() => {
      expect(booksApi.deleteBook).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app");
    });
  });

  it("saves chapter actual resource ids through pickers", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "编辑元信息" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "编辑元信息" })[1]!);

    const editor = screen.getByText("章节实际关联资源").closest("div")?.parentElement?.parentElement;
    expect(editor).not.toBeNull();
    const scope = within(editor as HTMLElement);

    fireEvent.click(scope.getByRole("checkbox", { name: /林夜/ }));
    fireEvent.click(scope.getByRole("checkbox", { name: /青岳宗/ }));
    fireEvent.click(scope.getByRole("checkbox", { name: /黑铁令/ }));
    fireEvent.click(scope.getByRole("checkbox", { name: /令牌异常/ }));
    fireEvent.click(scope.getByRole("checkbox", { name: /外门制度/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存章节信息" }));

    await waitFor(() => {
      expect(chaptersApi.updateChapter).toHaveBeenCalledWith(
        1,
        2,
        expect.objectContaining({
          actualCharacterIds: "11",
          actualFactionIds: "21",
          actualItemIds: "31",
          actualHookIds: "41",
          actualWorldSettingIds: "51",
        }),
      );
    });
  });

  it("passes provider and model tiers to chapter workbench when creating chapter", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建并进入工作台" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "anthropic" } });
    fireEvent.change(screen.getByLabelText("Low Model"), { target: { value: "claude-haiku-4-5" } });
    fireEvent.change(screen.getByLabelText("Mid Model"), { target: { value: "claude-sonnet-4-6" } });
    fireEvent.change(screen.getByLabelText("High Model"), { target: { value: "claude-opus-4-7" } });
    fireEvent.click(screen.getByRole("button", { name: "创建并进入工作台" }));

    await waitFor(() => {
      expect(chaptersApi.createChapter).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          chapterNo: 3,
        }),
      );
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app/books/1/chapters/3", {
        state: {
          provider: "anthropic",
          lowModel: "claude-haiku-4-5",
          midModel: "claude-sonnet-4-6",
          highModel: "claude-opus-4-7",
        },
      });
    });
  });

  it("deletes a chapter after confirmation", async () => {
    renderWithRoute(<BookDashboardPage />, "/app/books/1", "/app/books/:bookId");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "删除章节" })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "删除章节" })[1]!);

    await waitFor(() => {
      expect(chaptersApi.deleteChapter).toHaveBeenCalledWith(1, 2);
    });
  });
});
