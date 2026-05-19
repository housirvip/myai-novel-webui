import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { BookView, CreateBookInput, UpdateBookInput } from "@/lib/types";

export function listBooks(limit = 50) {
  return apiGet<BookView[]>(`/api/books?limit=${limit}`);
}

export function getBook(bookId: number) {
  return apiGet<BookView>(`/api/books/${bookId}`);
}

export function createBook(input: CreateBookInput) {
  return apiPost<BookView, CreateBookInput>("/api/books", input);
}

export function updateBook(bookId: number, input: UpdateBookInput) {
  return apiPatch<BookView, UpdateBookInput>(`/api/books/${bookId}`, input);
}

export function deleteBook(bookId: number) {
  return apiDelete<{ ok: true }>(`/api/books/${bookId}`);
}
