import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { formatApiErrorMessage } from "@/lib/api";
import { createBook, listBooks } from "@/lib/books-api";
import { queryKeys } from "@/lib/query/query-keys";

export function BooksPage() {
  const queryClient = useQueryClient();
  const booksQuery = useQuery({
    queryKey: queryKeys.books(),
    queryFn: () => listBooks(),
  });

  const createBookMutation = useMutation({
    mutationFn: () =>
      createBook({
        title: `新作品 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`,
        summary: "通过 WebUI 快速创建的新书籍。",
        targetChapterCount: 100,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.books() });
    },
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">书籍总览</h2>
          <p className="mt-1 text-sm text-slate-500">从这里进入你的作品、章节工作台和成稿阅读区。</p>
        </div>
        <button
          onClick={() => createBookMutation.mutate()}
          disabled={createBookMutation.isPending}
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {createBookMutation.isPending ? "创建中..." : "快速新建书籍"}
        </button>
      </div>

      {createBookMutation.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formatApiErrorMessage(createBookMutation.error, "创建书籍失败")}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {booksQuery.isLoading && Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" />
          ))}

          {booksQuery.data?.map((book) => (
            <Link
              key={book.id}
              to={`/app/books/${book.id}`}
              className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-28 rounded-[22px] bg-gradient-to-br from-violet-500 via-indigo-500 to-amber-300 opacity-90" />
              <div className="mt-4 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{book.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {book.summary || "暂未填写简介。"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">目标 {book.target_chapter_count ?? "—"} 章</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">已批准 {book.current_chapter_count} 章</span>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{book.status}</span>
                </div>
              </div>
            </Link>
          ))}

          {booksQuery.data && booksQuery.data.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              当前还没有书籍，点击右上角按钮即可快速创建一条示例数据。
            </div>
          )}
      </div>
    </section>
  );
}
