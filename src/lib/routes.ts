export function parseBookId(value: string | undefined) {
  const bookId = Number(value);
  return Number.isInteger(bookId) && bookId > 0 ? bookId : null;
}

export function parseChapterNo(value: string | undefined) {
  const chapterNo = Number(value);
  return Number.isInteger(chapterNo) && chapterNo > 0 ? chapterNo : null;
}

export function bookDashboardPath(bookId: number) {
  return `/app/books/${bookId}`;
}

export function bookReaderPath(bookId: number) {
  return `/app/books/${bookId}/read`;
}

export function bookResourcesPath(bookId: number) {
  return `/app/books/${bookId}/resources`;
}

export function chapterWorkbenchPath(bookId: number, chapterNo: number) {
  return `/app/books/${bookId}/chapters/${chapterNo}`;
}

export function settingsPath() {
  return "/app/settings";
}
