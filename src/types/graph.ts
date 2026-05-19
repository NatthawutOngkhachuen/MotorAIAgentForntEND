export type GraphNodeData = {
  id: string;
  label: string;
  type?: string;
  description?: string;
  properties?: Record<string, unknown>;
};

export type GraphEdgeData = {
  id?: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  properties?: Record<string, unknown>;
};

export type KnowledgeGraphData = {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
};

export type RelationshipDetail = {
  edge: GraphEdgeData;
  source?: GraphNodeData;
  target?: GraphNodeData;
};

