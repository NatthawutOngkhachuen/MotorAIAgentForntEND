import { apiRequest } from "@/services/apiClient";
import { graphService as knowledgeGraphService } from "@/services/graphService";
import type { AuthSession, BotSettings } from "@/types/api";

export const authService = {
  login: (payload: { username: string; password: string }) =>
    apiRequest<AuthSession>("/api/v1/auth/login", {
      method: "GET",
      skipAuth: true,
      query: payload,
    }),
  register: (payload: { username: string; password: string; name: string; age: number; gender: number }) =>
    apiRequest<AuthSession>("/api/v1/auth/register", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(payload),
    }),
};

export const graphService = {
  getGraph: knowledgeGraphService.getGraph,
};

export const botSettingsService = {
  getSettings: () => apiRequest<BotSettings>("/bot/settings"),
  updateSettings: (settings: BotSettings) =>
    apiRequest<BotSettings>("/bot/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
