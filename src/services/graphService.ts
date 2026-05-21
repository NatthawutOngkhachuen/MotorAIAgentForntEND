import { apiRequest } from "@/services/apiClient";
import type { GraphEdgeData, GraphNodeData, KnowledgeGraphData } from "@/types/graph";

type RecordPayload = Record<string, unknown>;

function isRecord(value: unknown): value is RecordPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFromValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (isRecord(value)) {
    return stringFromFields(value, ["id", "_id", "entityId", "nodeId", "key", "label", "name"]);
  }

  return undefined;
}

function stringFromFields(record: RecordPayload, fields: string[]) {
  for (const field of fields) {
    const value = stringFromValue(record[field]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function propertiesFrom(record: RecordPayload, consumedFields: string[]) {
  const consumed = new Set(consumedFields);
  const properties: Record<string, unknown> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (!consumed.has(key) && value !== undefined && typeof value !== "function") {
      properties[key] = value;
    }
  });

  return Object.keys(properties).length > 0 ? properties : undefined;
}

function normalizeNode(value: unknown, index: number): GraphNodeData {
  const record = isRecord(value) ? value : {};
  const idFields = ["id", "_id", "entityId", "nodeId", "key"];
  const labelFields = ["name", "title", "value", "text", "label"];
  const typeFields = ["type", "entityType", "category", "kind", "label"];
  const descriptionFields = ["description", "summary", "detail", "details"];
  const id = stringFromFields(record, idFields) ?? `node-${index}`;
  const label = stringFromFields(record, labelFields) ?? id;
  const type = stringFromFields(record, typeFields);
  const description = stringFromFields(record, descriptionFields);
  const properties =
    isRecord(record.properties) || isRecord(record.props) || isRecord(record.metadata)
      ? {
          ...(isRecord(record.properties) ? record.properties : {}),
          ...(isRecord(record.props) ? record.props : {}),
          ...(isRecord(record.metadata) ? record.metadata : {}),
        }
      : propertiesFrom(record, [...idFields, ...labelFields, ...typeFields, ...descriptionFields]);

  return {
    id,
    label,
    ...(type ? { type } : {}),
    ...(description ? { description } : {}),
    ...(properties ? { properties } : {}),
  };
}

function normalizeEdge(value: unknown, index: number): GraphEdgeData | null {
  const record = isRecord(value) ? value : {};
  const idFields = ["id", "_id", "relationId", "edgeId"];
  const sourceFields = ["source", "sourceId", "from", "fromId", "startNode", "startNodeId"];
  const targetFields = ["target", "targetId", "to", "toId", "endNode", "endNodeId"];
  const labelFields = ["rel", "relation", "relationType", "type", "label", "name"];
  const typeFields = ["rel", "relationType", "type", "relation"];
  const source = stringFromFields(record, sourceFields);
  const target = stringFromFields(record, targetFields);

  if (!source || !target) {
    return null;
  }

  const id = stringFromFields(record, idFields) ?? `${source}-${target}-${index}`;
  const label = stringFromFields(record, labelFields);
  const type = stringFromFields(record, typeFields);
  const properties =
    isRecord(record.properties) || isRecord(record.props) || isRecord(record.metadata)
      ? {
          ...(isRecord(record.properties) ? record.properties : {}),
          ...(isRecord(record.props) ? record.props : {}),
          ...(isRecord(record.metadata) ? record.metadata : {}),
        }
      : propertiesFrom(record, [...idFields, ...sourceFields, ...targetFields, ...labelFields, ...typeFields]);

  return {
    id,
    source,
    target,
    ...(label ? { label } : {}),
    ...(type ? { type } : {}),
    ...(properties ? { properties } : {}),
  };
}

export function normalizeGraphResponse(payload: unknown): KnowledgeGraphData {
  const response = isRecord(payload) ? payload : {};
  const graph = isRecord(response.data) ? response.data : response;
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : Array.isArray(graph.entities) ? graph.entities : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : Array.isArray(graph.relations) ? graph.relations : [];
  const nodes = rawNodes.map(normalizeNode);
  const edges = rawEdges
    .map(normalizeEdge)
    .filter((edge): edge is GraphEdgeData => Boolean(edge));

  return { nodes, edges };
}

export const normalizeKnowledgeGraphResponse = normalizeGraphResponse;

export const graphService = {
  getGraph: async () => normalizeGraphResponse(await apiRequest<unknown>("/api/v1/graph")),
};
