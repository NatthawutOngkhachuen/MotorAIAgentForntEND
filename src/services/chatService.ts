import { API_BASE_URL, ApiError, apiRequest } from "@/services/apiClient";
import { clearAuthStorage, getStoredAccessToken, getStoredAuthUser } from "@/services/authStorage";

export interface ChatSession {
  id: string;
  title?: string;
  preview?: string;
  createdAt?: string;
  updatedAt?: string;
  ownerValues?: string[];
}

export interface NormalizedChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  responseTimeMs?: number;
}

export type RecommendationMode = "user-based" | "cluster-based" | "graph-rag";

export interface RecommendationStreamHandlers {
  onSession?: (sessionId: string) => void;
  onMetadata?: (metadata: unknown) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: unknown) => void;
  signal?: AbortSignal;
}

type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: unknown, keys: string[]) {
  if (!isRecord(source)) {
    return undefined;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return undefined;
}

function collectOwnerValues(source: unknown) {
  if (!isRecord(source)) {
    return [];
  }

  const values = new Set<string>();
  for (const key of ["userId", "user_id", "username", "ownerId", "owner_id", "createdBy", "created_by"]) {
    const value = source[key];
    if ((typeof value === "string" && value.trim()) || typeof value === "number") {
      values.add(String(value).trim());
    }
  }

  for (const key of ["user", "owner", "created_by_user"]) {
    const nested = source[key];
    if (isRecord(nested)) {
      collectOwnerValues(nested).forEach((value) => values.add(value));
      for (const nestedKey of ["id", "userId", "username", "name"]) {
        const value = nested[nestedKey];
        if ((typeof value === "string" && value.trim()) || typeof value === "number") {
          values.add(String(value).trim());
        }
      }
    }
  }

  return [...values].filter(Boolean);
}

function stringifyReplyValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value) || isRecord(value)) {
    return JSON.stringify(value, null, 2);
  }

  return undefined;
}

function readReplyValue(source: unknown, keys: string[]) {
  if (!isRecord(source)) {
    return undefined;
  }

  for (const key of keys) {
    const value = stringifyReplyValue(source[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readNestedArray(response: unknown, keys: string[]) {
  if (Array.isArray(response)) {
    return response;
  }

  if (!isRecord(response)) {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(response[key])) {
      return response[key] as unknown[];
    }
  }

  const data = response.data;
  if (isRecord(data)) {
    for (const key of keys) {
      if (Array.isArray(data[key])) {
        return data[key] as unknown[];
      }
    }
  }

  return [];
}

function normalizeRole(value?: string): "user" | "assistant" {
  const role = value?.toLowerCase();
  if (role === "user" || role === "human" || role === "customer") {
    return "user";
  }
  return "assistant";
}

const userContentKeys = ["question", "content", "message", "text"];
const assistantContentKeys = ["answer", "response", "reply", "content", "message", "text", "result", "recommendation", "recommendations"];

function normalizeSession(item: unknown): ChatSession | null {
  const id = readString(item, ["session_id", "sessionId", "id", "conversation_id", "conversationId"]);
  if (!id) {
    return null;
  }

  const preview = readReplyValue(item, ["preview", "first_message", "firstMessage", "last_message", "lastMessage", "question", "message", "content"]);

  return {
    id,
    title: readString(item, ["title", "name", "topic"]),
    preview,
    createdAt: readString(item, ["created_at", "createdAt", "timestamp"]) ?? undefined,
    updatedAt: readString(item, ["updated_at", "updatedAt", "timestamp"]) ?? undefined,
    ownerValues: collectOwnerValues(item),
  };
}

function buildMessage(item: unknown, index: number, role: "user" | "assistant", content: string, idSuffix = ""): NormalizedChatMessage {
  const id = readString(item, ["id", "message_id", "messageId"]) ?? `message-${index}`;

  return {
    id: `${id}${idSuffix}`,
    role,
    content,
    createdAt: readString(item, ["created_at", "createdAt", "timestamp"]),
  };
}

function normalizeMessage(item: unknown, index: number): NormalizedChatMessage[] {
  const question = readReplyValue(item, ["question"]);
  const answer = readReplyValue(item, ["answer", "response", "reply"]);
  if (question && answer) {
    return [
      buildMessage(item, index, "user", question, "-question"),
      buildMessage(item, index, "assistant", answer, "-answer"),
    ];
  }

  const role = normalizeRole(readString(item, ["role", "sender", "type"]));
  const keys = role === "user" ? userContentKeys : assistantContentKeys;
  const content = readReplyValue(item, keys);
  if (!content) {
    return [];
  }

  return [buildMessage(item, index, role, content)];
}

function normalizeSessions(response: unknown) {
  return readNestedArray(response, ["sessions", "data"])
    .map((item) => normalizeSession(item))
    .filter((session): session is ChatSession => Boolean(session));
}

function sessionBelongsToStoredUser(session: ChatSession) {
  if (!session.ownerValues?.length) {
    return true;
  }

  const user = getStoredAuthUser();
  if (!user) {
    return false;
  }

  const currentUserValues = [user.id, user.userId, user.user_id, user.username]
    .filter((value): value is string | number => value !== undefined && value !== null && String(value).trim().length > 0)
    .map((value) => String(value).trim().toLowerCase());

  if (currentUserValues.length === 0) {
    return false;
  }

  return session.ownerValues.some((value) => currentUserValues.includes(value.trim().toLowerCase()));
}

function normalizeHistory(response: unknown) {
  return readNestedArray(response, ["messages", "history", "data"])
    .flatMap(normalizeMessage)
    .filter((message): message is NormalizedChatMessage => Boolean(message));
}

function readNestedReply(response: unknown, keys: string[]) {
  const direct = readReplyValue(response, keys);
  if (direct) {
    return direct;
  }

  if (isRecord(response)) {
    return readReplyValue(response.data, keys);
  }

  return undefined;
}

function readNestedString(response: unknown, keys: string[]) {
  const direct = readString(response, keys);
  if (direct) {
    return direct;
  }

  if (isRecord(response)) {
    return readString(response.data, keys);
  }

  return undefined;
}

function parseSseData(data: string): unknown {
  if (!data.trim()) {
    return "";
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function extractSessionId(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  return readNestedString(payload, ["session_id", "sessionId", "id"]);
}

function extractToken(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }

  return readNestedReply(payload, ["token", "delta", "content", "text", "message", "answer", "response"]);
}

function formatStreamErrorBody(body: string, response: Response) {
  if (!body.trim()) {
    return response.statusText || "Request failed";
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const message = parsed.message ?? parsed.detail;
    return typeof message === "string" && message.trim() ? message : JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

function buildRecommendationUrl(mode: RecommendationMode, action: "start" | "chat") {
  if (!API_BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured.", 0);
  }

  if (mode === "graph-rag") {
    return `${API_BASE_URL}/api/v1/chat`;
  }

  return `${API_BASE_URL}/api/v1/recommendation/${mode}/${action}`;
}

function buildStreamHeaders(hasBody: boolean) {
  const headers = new Headers();
  headers.set("Accept", "text/event-stream");
  headers.set("ngrok-skip-browser-warning", "true");

  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = getStoredAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return { headers, accessToken };
}

function dispatchSseEvent(eventType: string, data: string, handlers: RecommendationStreamHandlers) {
  const payload = parseSseData(data);
  const effectiveEventType = eventType === "message" ? readNestedString(payload, ["type", "event"]) ?? eventType : eventType;

  switch (effectiveEventType) {
    case "session": {
      const sessionId = extractSessionId(payload);
      if (sessionId) {
        handlers.onSession?.(sessionId);
      }
      break;
    }
    case "metadata":
      handlers.onMetadata?.(payload);
      break;
    case "token": {
      const token = extractToken(payload);
      if (token) {
        handlers.onToken?.(token);
      }
      break;
    }
    case "done":
      handlers.onDone?.(payload);
      break;
  }
}

function processSseBlock(block: string, handlers: RecommendationStreamHandlers) {
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    const normalizedLine = line.replace(/\r$/, "");
    if (!normalizedLine || normalizedLine.startsWith(":")) {
      continue;
    }

    const separatorIndex = normalizedLine.indexOf(":");
    const field = separatorIndex === -1 ? normalizedLine : normalizedLine.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? "" : normalizedLine.slice(separatorIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      eventType = value || "message";
    }
    if (field === "data") {
      dataLines.push(value);
    }
  }

  dispatchSseEvent(eventType, dataLines.join("\n"), handlers);
}

async function streamRecommendationRequest(url: string, body: string | undefined, handlers: RecommendationStreamHandlers = {}) {
  const { headers, accessToken } = buildStreamHeaders(Boolean(body));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: handlers.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(`Request failed: ${message}`, 0, error);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 401 && accessToken) {
      clearAuthStorage();
      throw new ApiError("Login required. Please sign in again.", response.status, errorBody);
    }

    throw new ApiError(`Request failed (${response.status}): ${formatStreamErrorBody(errorBody, response)}`, response.status, errorBody);
  }

  if (!response.body) {
    throw new ApiError("Streaming response did not include a body.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";
    parts.forEach((part) => processSseBlock(part, handlers));

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    processSseBlock(buffer, handlers);
  }
}

export const chatService = {
  async getChatSessions() {
    const response = await apiRequest<unknown>("/api/v1/sessions", {
      method: "GET",
    });
    return normalizeSessions(response).filter(sessionBelongsToStoredUser);
  },

  async getChatHistory(sessionId: string) {
    const response = await apiRequest<unknown>(`/api/v1/history/${encodeURIComponent(sessionId)}`, {
      method: "GET",
    });
    return normalizeHistory(response);
  },

  async deleteChatSession(sessionId: string) {
    return apiRequest<unknown>(`/api/v1/session/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },

  async startRecommendationChat(mode: RecommendationMode, handlers: RecommendationStreamHandlers = {}) {
    if (mode !== "user-based") {
      return undefined;
    }

    let sessionId: string | undefined;
    await streamRecommendationRequest(buildRecommendationUrl(mode, "start"), undefined, {
      ...handlers,
      onSession: (nextSessionId) => {
        sessionId = nextSessionId;
        handlers.onSession?.(nextSessionId);
      },
    });
    return sessionId;
  },

  async streamRecommendationChatMessage(mode: RecommendationMode, question: string, sessionId: string | undefined, handlers: RecommendationStreamHandlers = {}) {
    await streamRecommendationRequest(
      buildRecommendationUrl(mode, "chat"),
      JSON.stringify({
        question,
        language: "th",
        session_id: sessionId,
      }),
      handlers,
    );
  },
};
