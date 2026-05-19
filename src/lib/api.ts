export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiUnauthorizedError extends ApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(status, code, message, details);
    this.name = "ApiUnauthorizedError";
  }
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);

  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      0,
      "network_error",
      `Network request failed: ${method} ${target}`,
      error instanceof Error ? error.message : error,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const bodyText = await response.text();
    throw new ApiError(
      response.status,
      "invalid_response",
      `Expected JSON response: ${method} ${target}`,
      bodyText.slice(0, 500),
    );
  }

  const json = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;

  if (!response.ok) {
    const error = (json as ApiErrorEnvelope).error;
    const ErrorClass = response.status === 401 ? ApiUnauthorizedError : ApiError;
    throw new ErrorClass(
      response.status,
      error?.code ?? "unknown_error",
      error?.message ?? "Request failed",
      error?.details,
    );
  }

  return (json as ApiEnvelope<T>).data;
}

export function apiGet<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return request<T>(input, { ...init, method: init?.method ?? "GET" });
}

export function apiPost<T, TBody>(input: RequestInfo | URL, body: TBody, init?: RequestInit): Promise<T> {
  return request<T>(input, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPatch<T, TBody>(input: RequestInfo | URL, body: TBody, init?: RequestInit): Promise<T> {
  return request<T>(input, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiPut<T, TBody>(input: RequestInfo | URL, body: TBody, init?: RequestInit): Promise<T> {
  return request<T>(input, {
    ...init,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return request<T>(input, {
    ...init,
    method: "DELETE",
  });
}

function summarizeDetails(details: unknown): string | null {
  if (details === null || details === undefined) return null;
  if (typeof details === "string") return details;
  if (typeof details === "number" || typeof details === "boolean") return String(details);
  try {
    const serialized = JSON.stringify(details);
    if (!serialized) return null;
    return serialized.length > 200 ? `${serialized.slice(0, 200)}…` : serialized;
  } catch {
    return null;
  }
}

export function formatApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "network_error") {
      return `网络异常：${error.message}`;
    }
    const detailText = summarizeDetails(error.details);
    const head = `[${error.code}] ${error.message || fallback}`;
    return detailText ? `${head}（details: ${detailText}）` : head;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
