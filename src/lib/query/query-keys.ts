export const queryKeys = {
  authSession: () => ["authSession"] as const,
  userRuntimeSettings: () => ["userRuntimeSettings"] as const,
  meta: () => ["meta"] as const,
  books: () => ["books"] as const,
  book: (bookId: number | string) => ["book", bookId] as const,
  chapters: (bookId: number | string, filters?: unknown) => ["chapters", bookId, filters ?? null] as const,
  chapter: (bookId: number | string, chapterNo: number | string) => ["chapter", bookId, chapterNo] as const,
  chapterWorkflowState: (bookId: number | string, chapterNo: number | string) =>
    ["chapterWorkflowState", bookId, chapterNo] as const,
  chapterStage: (bookId: number | string, chapterNo: number | string, stage: string) =>
    ["chapterStage", bookId, chapterNo, stage] as const,
  chapterStageHistory: (bookId: number | string, chapterNo: number | string, stage: string, limit?: number) =>
    ["chapterStageHistory", bookId, chapterNo, stage, limit ?? 20] as const,
  workflowTask: (taskId: number | string) => ["workflowTask", taskId] as const,
  latestChapterWorkflowTask: (bookId: number | string, chapterNo: number | string, workflowType: string) =>
    ["latestChapterWorkflowTask", bookId, chapterNo, workflowType] as const,
  chapterWorkflowTasks: (bookId: number | string, chapterNo: number | string, limit?: number) =>
    ["chapterWorkflowTasks", bookId, chapterNo, limit ?? 20] as const,
  resourceList: (bookId: number | string, resourceType: string, filters?: unknown) =>
    ["resourceList", bookId, resourceType, filters ?? null] as const,
};
