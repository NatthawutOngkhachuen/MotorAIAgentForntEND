export interface ApiCollection<T> {
  items: T[];
  total?: number;
}

export interface AuthSession {
  accessToken?: string;
  access_token?: string;
  token?: string;
  jwt?: string;
  user?: {
    id?: string | number;
    userId?: string | number;
    username?: string;
    name?: string;
    email?: string;
    age?: string | number;
    gender?: string | number;
    role?: string;
  };
  data?: {
    accessToken?: string;
    access_token?: string;
    token?: string;
    jwt?: string;
    user?: {
      id?: string | number;
      userId?: string | number;
      username?: string;
      name?: string;
      email?: string;
      age?: string | number;
      gender?: string | number;
      role?: string;
    };
    id?: string | number;
    userId?: string | number;
    username?: string;
    name?: string;
    age?: string | number;
    gender?: string | number;
    role?: string;
  };
  profile?: Record<string, unknown>;
  account?: Record<string, unknown>;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  trend?: string;
}

export type { GraphEdgeData as GraphEdge, GraphNodeData as GraphNode, KnowledgeGraphData as KnowledgeGraphResponse } from "@/types/graph";

export interface Entity {
  id: string;
  name: string;
  type?: string;
  description?: string;
  confidence?: number;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type?: string;
  confidence?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  citations?: Array<{ id: string; label: string; url?: string }>;
}

export interface BotSettings {
  systemPrompt?: string;
  retrievalTopK?: number;
  temperature?: number;
  graphDepth?: number;
  enableCitations?: boolean;
}
