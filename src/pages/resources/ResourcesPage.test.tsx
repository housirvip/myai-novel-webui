import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as ReactRouter from "react-router-dom";
import { vi } from "vitest";

import { ResourcesPage } from "@/pages/resources/ResourcesPage";
import * as resourcesApi from "@/lib/resources-api";
import { renderWithRoute } from "@/test/utils";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

describe("ResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReactRouter.useParams).mockReturnValue({ bookId: "1" });

    vi.spyOn(resourcesApi, "listOutlines").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listWorldSettings").mockResolvedValue([]);
    vi.spyOn(resourcesApi, "listCharacters").mockResolvedValue([{ id: 11, name: "林夜", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listFactions").mockResolvedValue([{ id: 21, name: "青岳宗", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listItems").mockResolvedValue([{ id: 31, name: "黑铁令", status: "active" } as never]);
    vi.spyOn(resourcesApi, "listRelations").mockResolvedValue([
      {
        id: 41,
        sourceType: "character",
        sourceId: 11,
        targetType: "faction",
        targetId: 21,
        relationType: "member",
        status: "active",
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);
    vi.spyOn(resourcesApi, "listStoryHooks").mockResolvedValue([{ id: 51, title: "黑铁令异常", status: "open" } as never]);

    vi.spyOn(resourcesApi, "createOutline").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createWorldSetting").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createCharacter").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createFaction").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createRelation").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createItem").mockResolvedValue({ id: 1 } as never);
    vi.spyOn(resourcesApi, "createStoryHook").mockResolvedValue({ id: 1 } as never);
  });

  it("uses enum select for character status in resource editor", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Characters/ }));

    await waitFor(() => {
      expect(screen.getByText("Characters 列表")).toBeInTheDocument();
    });

    const editor = screen.getByRole("heading", { name: "新建 Characters" }).closest("aside");
    expect(editor).not.toBeNull();
    const formScope = within(editor as HTMLElement);
    const statusSelect = formScope.getByRole("combobox", { name: "状态" });

    expect(statusSelect).toHaveValue("alive");
    expect(within(statusSelect).getByRole("option", { name: "存活" })).toBeInTheDocument();
    expect(within(statusSelect).getByRole("option", { name: "死亡" })).toBeInTheDocument();
  });

  it("uses enum selects for item rarity and category in resource editor", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Items/ }));

    await waitFor(() => {
      expect(screen.getByText("Items 列表")).toBeInTheDocument();
    });

    const editor = screen.getByRole("heading", { name: "新建 Items" }).closest("aside");
    expect(editor).not.toBeNull();
    const formScope = within(editor as HTMLElement);

    const categorySelect = formScope.getByRole("combobox", { name: "分类" });
    const raritySelect = formScope.getByRole("combobox", { name: "稀有度" });

    expect(within(categorySelect).getByRole("option", { name: "令牌" })).toBeInTheDocument();
    expect(within(raritySelect).getByRole("option", { name: "传说" })).toBeInTheDocument();
  });

  it("uses enum select for hook type in resource editor", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Hooks/ }));

    await waitFor(() => {
      expect(screen.getByText("Hooks 列表")).toBeInTheDocument();
    });

    const editor = screen.getByRole("heading", { name: "新建 Hooks" }).closest("aside");
    expect(editor).not.toBeNull();
    const formScope = within(editor as HTMLElement);
    const hookTypeSelect = formScope.getByRole("combobox", { name: "钩子类型" });

    expect(within(hookTypeSelect).getByRole("option", { name: "伏笔" })).toBeInTheDocument();
    expect(within(hookTypeSelect).getByRole("option", { name: "回收" })).toBeInTheDocument();
  });

  it("creates a relation with entity pickers", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Relations/ }));

    await waitFor(() => {
      expect(screen.getByText("Relations 列表")).toBeInTheDocument();
    });

    const editor = screen.getByRole("heading", { name: "新建 Relations" }).closest("aside");
    expect(editor).not.toBeNull();
    const formScope = within(editor as HTMLElement);

    fireEvent.change(formScope.getByRole("combobox", { name: "起点类型" }), { target: { value: "character" } });
    fireEvent.change(formScope.getByRole("combobox", { name: "终点类型" }), { target: { value: "faction" } });
    fireEvent.change(formScope.getByRole("combobox", { name: "起点实体" }), { target: { value: "11" } });
    fireEvent.change(formScope.getByRole("combobox", { name: "终点实体" }), { target: { value: "21" } });
    fireEvent.change(formScope.getByRole("combobox", { name: "关系类型" }), { target: { value: "mentor" } });

    fireEvent.click(screen.getByRole("button", { name: "创建资源" }));

    await waitFor(() => {
      expect(resourcesApi.createRelation).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          sourceType: "character",
          sourceId: 11,
          targetType: "faction",
          targetId: 21,
          relationType: "mentor",
        }),
      );
    });
  });

  it("blocks relation creation until both endpoints are selected", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Relations/ }));

    await waitFor(() => {
      expect(screen.getByText("Relations 列表")).toBeInTheDocument();
    });

    const editor = screen.getByRole("heading", { name: "新建 Relations" }).closest("aside");
    expect(editor).not.toBeNull();
    const formScope = within(editor as HTMLElement);

    fireEvent.change(formScope.getByRole("combobox", { name: "关系类型" }), { target: { value: "mentor" } });

    expect(screen.getByRole("button", { name: "创建资源" })).toBeDisabled();
    expect(screen.getByText("请先选择起点实体。")).toBeInTheDocument();
    expect(resourcesApi.createRelation).not.toHaveBeenCalled();
  });

  it("shows localized owner info on item cards", async () => {
    vi.mocked(resourcesApi.listItems).mockResolvedValue([
      {
        id: 31,
        name: "黑铁令",
        ownerType: "character",
        ownerId: 11,
        status: "active",
        description: "关键令牌",
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);

    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Items/ }));

    await waitFor(() => {
      expect(screen.getByText("角色：林夜 · 启用")).toBeInTheDocument();
    });
  });

  it("shows localized relation meta on relation cards", async () => {
    vi.mocked(resourcesApi.listRelations).mockResolvedValue([
      {
        id: 41,
        sourceType: "character",
        sourceId: 11,
        targetType: "faction",
        targetId: 21,
        relationType: "leader",
        status: "active",
        description: "旧关系",
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z",
      } as never,
    ]);

    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Relations/ }));

    await waitFor(() => {
      expect(screen.getByText("领导 · 启用")).toBeInTheDocument();
    });
  });

  it("shows localized status on other resource cards", async () => {
    vi.mocked(resourcesApi.listCharacters).mockResolvedValue([
      { id: 11, name: "林夜", status: "alive", currentLocation: "云岚城" } as never,
    ]);

    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Characters/ }));

    await waitFor(() => {
      expect(screen.getByText("存活 · 云岚城")).toBeInTheDocument();
    });
  });

  it("shows relation entity names on relation cards", async () => {
    renderWithRoute(<ResourcesPage />, "/app/books/1/resources", "/app/books/:bookId/resources");

    fireEvent.click(screen.getByRole("button", { name: /Relations/ }));

    await waitFor(() => {
      expect(screen.getByText("Relations 列表")).toBeInTheDocument();
      expect(screen.getByText("character:11 → faction:21")).toBeInTheDocument();
      expect(screen.getByText("林夜 → 青岳宗")).toBeInTheDocument();
    });
  });

});
