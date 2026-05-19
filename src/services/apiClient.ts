import { clearAuthStorage, getStoredAccessToken } from "@/services/authStorage";

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const isApiConfigured = Boolean(API_BASE_URL);

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  return response.text();
}

function formatErrorBody(body: unknown, response: Response) {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.detail;

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    return JSON.stringify(body, null, 2);
  }

  return response.statusText || "Request failed";
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured.", 0);
  }

  const { query, token, skipAuth, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("ngrok-skip-browser-warning", "true");
  const accessToken = skipAuth ? null : token?.trim().replace(/^Bearer\s+/i, "") ?? getStoredAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  let response: Response;
  try {
    response = await fetch(url, {
      ...requestOptions,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(`Request failed: ${message}`, 0, error);
  }
  const body = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401 && accessToken) {
      clearAuthStorage();
      throw new ApiError("Login required. Please sign in again.", response.status, body);
    }

    const message = formatErrorBody(body, response);
    throw new ApiError(`Request failed (${response.status}): ${message}`, response.status, body);
  }

  return body as T;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
