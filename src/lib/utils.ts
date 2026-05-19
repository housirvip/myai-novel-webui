import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseIdList(value: string | null) {
  if (!value) {
    return [] as number[];
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return [] as number[];
  }

  if (normalizedValue.startsWith("[") && normalizedValue.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalizedValue);
      if (Array.isArray(parsed)) {
        return [...new Set(
          parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0),
        )];
      }
    } catch {
      // fall through to the delimited-string parser
    }
  }

  return [...new Set(
    normalizedValue
      .split(/[\s,]+/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0),
  )];
}

export function formatIdList(ids: number[]) {
  const normalizedIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((left, right) => left - right);
  return normalizedIds.length > 0 ? normalizedIds.join(",") : null;
}
