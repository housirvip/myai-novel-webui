import { fireEvent, screen } from "@testing-library/react";

import { AppShell } from "@/app/layouts/AppShell";
import { renderWithRoute } from "@/test/utils";

describe("AppShell", () => {
  it("shows disabled book-scoped navigation without a selected book", () => {
    renderWithRoute(<AppShell />, "/app", "/app");

    expect(screen.getByText("当前未选择书籍")).toBeInTheDocument();
    expect(screen.getByText("先从书籍总览进入一本书，侧边栏会自动切换到当前书籍上下文。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "写作工作台" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "章节阅读" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "资源中心" })).toHaveAttribute("aria-disabled", "true");
  });

  it("does not keep books overview active on a book dashboard route", () => {
    renderWithRoute(<AppShell />, "/app/books/7", "/app/books/:bookId");

    expect(screen.getByRole("link", { name: "书籍总览" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "写作工作台" })).toHaveClass("bg-primary");
  });

  it("marks only the matching navigation item as active", () => {
    renderWithRoute(<AppShell />, "/app/books/7", "/app/books/:bookId");

    expect(screen.getByRole("link", { name: "书籍总览" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "写作工作台" })).toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "章节阅读" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "资源中心" })).not.toHaveClass("bg-primary");
  });

  it("marks reader navigation as active without keeping dashboard active", () => {
    renderWithRoute(<AppShell />, "/app/books/7/read", "/app/books/:bookId/read");

    expect(screen.getByRole("link", { name: "写作工作台" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "章节阅读" })).toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "资源中心" })).not.toHaveClass("bg-primary");
  });

  it("marks resources navigation as active without keeping dashboard active", () => {
    renderWithRoute(<AppShell />, "/app/books/7/resources", "/app/books/:bookId/resources");

    expect(screen.getByRole("link", { name: "写作工作台" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "章节阅读" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "资源中心" })).toHaveClass("bg-primary");
  });

  it("collapses and expands the global sidebar", () => {
    renderWithRoute(<AppShell />, "/app/books/7", "/app/books/:bookId");

    expect(screen.getByText("myai-novel WebUI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "折叠导航栏" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "折叠导航栏" }));

    expect(screen.queryByText("myai-novel WebUI")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开导航栏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "写作工作台" })).toHaveAttribute("title", "写作工作台");

    fireEvent.click(screen.getByRole("button", { name: "展开导航栏" }));

    expect(screen.getByText("myai-novel WebUI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "折叠导航栏" })).toBeInTheDocument();
  });

  it("uses current book context in navigation", () => {
    renderWithRoute(<AppShell />, "/app/books/7", "/app/books/:bookId");

    expect(screen.getByText("当前书籍：#7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "写作工作台" })).toHaveAttribute("href", "/app/books/7");
    expect(screen.getByRole("link", { name: "章节阅读" })).toHaveAttribute("href", "/app/books/7/read");
    expect(screen.getByRole("link", { name: "资源中心" })).toHaveAttribute("href", "/app/books/7/resources");
  });
});
