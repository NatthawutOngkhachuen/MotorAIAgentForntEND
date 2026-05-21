import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Expand, Maximize2, RefreshCw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { GraphCanvas, type GraphCanvasHandle } from "@/components/graph/GraphCanvas";
import { GraphDetailPanel } from "@/components/graph/GraphDetailPanel";
import { GraphFilterPanel } from "@/components/graph/GraphFilterPanel";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGraph } from "@/hooks/useGraph";
import type { GraphEdgeData, GraphNodeData, RelationshipDetail } from "@/types/graph";

const NODE_COLORS = ["#0891B2", "#1D4ED8", "#0284C7", "#6D28D9", "#059669", "#7C3AED", "#2563EB", "#475569"];

function getNodeType(node: GraphNodeData) {
  return node.type?.trim() || "Unknown";
}

function getEdgeId(edge: GraphEdgeData, index: number) {
  return edge.id ?? `${edge.source}-${edge.target}-${index}`;
}

function buildRelationship(edge: GraphEdgeData, nodeById: Map<string, GraphNodeData>): RelationshipDetail {
  return {
    edge,
    source: nodeById.get(edge.source),
    target: nodeById.get(edge.target),
  };
}

export function KnowledgeGraphPage() {
  const graphRef = useRef<GraphCanvasHandle>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  const query = useGraph();

  const nodes = useMemo(() => query.data?.nodes ?? [], [query.data?.nodes]);
  const edges = useMemo(() => query.data?.edges ?? [], [query.data?.edges]);
  const hasGraphData = Boolean(query.data);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const nodeTypes = useMemo(() => Array.from(new Set(nodes.map(getNodeType))).sort(), [nodes]);

  useEffect(() => {
    setSelectedTypes((current) => {
      if (current.size === 0) {
        return new Set(nodeTypes);
      }

      const next = new Set<string>();
      nodeTypes.forEach((type) => {
        if (current.has(type)) {
          next.add(type);
        }
      });
      return next;
    });
  }, [nodeTypes]);

  const validEdges = useMemo(
    () => edges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target)),
    [edges, nodeById],
  );

  const visibleNodes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return nodes.filter((node) => {
      const type = getNodeType(node);
      const searchText = `${node.label} ${type}`.toLowerCase();
      return selectedTypes.has(type) && (!normalizedSearch || searchText.includes(normalizedSearch));
    });
  }, [nodes, searchTerm, selectedTypes]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => validEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [validEdges, visibleNodeIds],
  );

  const typeColorMap = useMemo(
    () => new Map(nodeTypes.map((type, index) => [type, NODE_COLORS[index % NODE_COLORS.length]])),
    [nodeTypes],
  );

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    return visibleEdges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge) => buildRelationship(edge, nodeById));
  }, [nodeById, selectedNode, visibleEdges]);

  useEffect(() => {
    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(undefined);
    }
  }, [selectedNodeId, visibleNodeIds]);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedTypes(new Set(nodeTypes));
  };

  const toggleType = (type: string) => {
    setSelectedTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <motion.section
      className="grid min-h-[calc(100vh-3rem)] grid-rows-[auto_minmax(0,1fr)] gap-4 lg:h-[calc(100vh-3rem)] lg:overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div className="cockpit-surface moto-cut-card px-4 py-3">
        <div className="ai-light-sheen opacity-35" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="moto-heading whitespace-nowrap text-3xl">Knowledge GraphRAG</h1>
          </div>

          <div className="relative flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[200px] sm:w-[240px] xl:w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search visible nodes..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex shrink-0 flex-nowrap gap-1.5">
              <Button aria-label="Refresh graph" size="icon" variant="secondary" className="h-9 w-9" onClick={() => query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={query.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              </Button>
              <Button aria-label="Zoom in" size="icon" variant="outline" className="h-9 w-9" onClick={() => graphRef.current?.zoomIn()}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button aria-label="Zoom out" size="icon" variant="outline" className="h-9 w-9" onClick={() => graphRef.current?.zoomOut()}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button aria-label="Fit view" size="icon" variant="outline" className="h-9 w-9" onClick={() => graphRef.current?.fitView()}>
                <Expand className="h-3.5 w-3.5" />
              </Button>
              <Button aria-label="Fullscreen graph" size="icon" variant="outline" className="h-9 w-9" onClick={() => graphRef.current?.fullscreen()}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {query.isLoading && !hasGraphData ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}

      {!query.isLoading && !query.isError ? (
        nodes.length === 0 ? (
          <EmptyState title="No graph data returned" description="The graph endpoint returned no nodes. No mock graph data is displayed." />
        ) : (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <GraphFilterPanel
              nodeTypes={nodeTypes}
              selectedTypes={selectedTypes}
              typeColorMap={typeColorMap}
              onTypeToggle={toggleType}
              onReset={resetFilters}
            />

            <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <GraphCanvas
                ref={graphRef}
                nodes={visibleNodes}
                edges={visibleEdges.map((edge, index) => ({ ...edge, id: getEdgeId(edge, index) }))}
                typeColorMap={typeColorMap}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
              <GraphDetailPanel
                selectedNode={selectedNode}
                relationships={selectedNodeRelationships}
                onClose={() => setSelectedNodeId(undefined)}
              />
            </div>
          </div>
        )
      ) : null}
    </motion.section>
  );
}
