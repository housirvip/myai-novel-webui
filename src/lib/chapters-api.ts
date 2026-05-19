import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type {
  ChapterStage,
  ChapterStageHistoryEntry,
  ChapterStageView,
  ChapterView,
  ChapterWorkflowStateView,
  ChapterWritableStage,
  CreateChapterInput,
  UpdateChapterInput,
  UpdateStageInput,
} from "@/lib/types";

export function listChapters(bookId: number, limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) {
    params.set("status", status);
  }
  return apiGet<ChapterView[]>(`/api/books/${bookId}/chapters?${params.toString()}`);
}

export function createChapter(bookId: number, input: CreateChapterInput) {
  return apiPost<ChapterView, CreateChapterInput>(`/api/books/${bookId}/chapters`, input);
}

export function getChapter(bookId: number, chapterNo: number) {
  return apiGet<ChapterView>(`/api/books/${bookId}/chapters/${chapterNo}`);
}

export function updateChapter(bookId: number, chapterNo: number, input: UpdateChapterInput) {
  return apiPatch<ChapterView, UpdateChapterInput>(`/api/books/${bookId}/chapters/${chapterNo}`, input);
}

export function deleteChapter(bookId: number, chapterNo: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}/chapters/${chapterNo}`);
}

export function getChapterWorkflowState(bookId: number, chapterNo: number) {
  return apiGet<ChapterWorkflowStateView>(`/api/books/${bookId}/chapters/${chapterNo}/workflow-state`);
}

export function getChapterStage(bookId: number, chapterNo: number, stage: ChapterStage) {
  return apiGet<ChapterStageView>(`/api/books/${bookId}/chapters/${chapterNo}/stages/${stage}`);
}

export function listChapterStageHistory(bookId: number, chapterNo: number, stage: ChapterStage, limit = 20) {
  return apiGet<ChapterStageHistoryEntry[]>(
    `/api/books/${bookId}/chapters/${chapterNo}/stages/${stage}/history?limit=${limit}`,
  );
}

export function updateChapterStage(
  bookId: number,
  chapterNo: number,
  stage: ChapterWritableStage,
  input: UpdateStageInput,
) {
  return apiPut<ChapterView, UpdateStageInput>(`/api/books/${bookId}/chapters/${chapterNo}/stages/${stage}`, input);
}
