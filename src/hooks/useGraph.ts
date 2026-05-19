import { graphService } from "@/services/graphService";
import type { GraphEdgeData, GraphNodeData, KnowledgeGraphData } from "@/types/graph";
import { useApiQuery } from "./useApiQuery";

export const graphQueryKey = ["graph"] as const;

export type DashboardStatsFromGraph = {
  totalEntities: number;
  totalRelations: number;
  nodeTypes: number;
  relationTypes: number;
  unknownNodes: number;
  connectedNodes: number;
  isolatedNodes: number;
};

function getNodeType(node: GraphNodeData) {
  return node.type?.trim();
}

function getRelationType(edge: GraphEdgeData) {
  return edge.label?.trim() || edge.type?.trim();
}

export function calculateDashboardStatsFromGraph(graph: KnowledgeGraphData): DashboardStatsFromGraph {
  const nodeTypes = new Set(graph.nodes.map(getNodeType).filter((type): type is string => Boolean(type)));
  const relationTypes = new Set(graph.edges.map(getRelationType).filter((type): type is string => Boolean(type)));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const connectedNodeIds = new Set<string>();

  graph.edges.forEach((edge) => {
    if (nodeIds.has(edge.source)) {
      connectedNodeIds.add(edge.source);
    }
    if (nodeIds.has(edge.target)) {
      connectedNodeIds.add(edge.target);
    }
  });

  return {
    totalEntities: graph.nodes.length,
    totalRelations: graph.edges.length,
    nodeTypes: nodeTypes.size,
    relationTypes: relationTypes.size,
    unknownNodes: graph.nodes.filter((node) => !getNodeType(node) || getNodeType(node)?.toLowerCase() === "unknown").length,
    connectedNodes: connectedNodeIds.size,
    isolatedNodes: graph.nodes.length - connectedNodeIds.size,
  };
}

export function useGraph() {
  return useApiQuery<KnowledgeGraphData>({
    queryKey: graphQueryKey,
    queryFn: graphService.getGraph,
  });
}

export function useEntitiesFromGraph() {
  return useApiQuery<KnowledgeGraphData, GraphNodeData[]>({
    queryKey: graphQueryKey,
    queryFn: graphService.getGraph,
    select: (graph) => graph.nodes,
  });
}

export function useRelationsFromGraph() {
  return useApiQuery<KnowledgeGraphData, KnowledgeGraphData>({
    queryKey: graphQueryKey,
    queryFn: graphService.getGraph,
  });
}

export function useDashboardStatsFromGraph() {
  return useApiQuery<KnowledgeGraphData, DashboardStatsFromGraph>({
    queryKey: graphQueryKey,
    queryFn: graphService.getGraph,
    select: calculateDashboardStatsFromGraph,
  });
}
