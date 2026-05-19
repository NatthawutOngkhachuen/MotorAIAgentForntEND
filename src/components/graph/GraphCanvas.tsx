import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { GraphNode, type GraphFlowNode } from "@/components/graph/GraphNode";
import type { GraphEdgeData, GraphNodeData as KnowledgeGraphNode } from "@/types/graph";

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  fullscreen: () => void;
}

interface GraphCanvasProps {
  nodes: KnowledgeGraphNode[];
  edges: GraphEdgeData[];
  typeColorMap: Map<string, string>;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
}

const nodeTypes = {
  graphNode: GraphNode,
};

const EDGE_COLORS = ["#22D3EE", "#7C5CFF", "#2563EB", "#38BDF8", "#00FFA8"];

function typeLabel(node: KnowledgeGraphNode) {
  return node.type?.trim() || "Unknown";
}

function edgeId(edge: GraphEdgeData, index: number) {
  return edge.id ?? `${edge.source}-${edge.target}-${index}`;
}

function buildDegreeMap(nodes: KnowledgeGraphNode[], edges: GraphEdgeData[]) {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  });
  return degree;
}

function layoutNodes(nodes: KnowledgeGraphNode[], edges: GraphEdgeData[]) {
  if (nodes.length === 0) {
    return new Map<string, { x: number; y: number }>();
  }

  const degree = buildDegreeMap(nodes, edges);
  const centerNode = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label))[0];
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(centerNode.id, { x: 0, y: 0 });

  const remaining = nodes
    .filter((node) => node.id !== centerNode.id)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label));

  let cursor = 0;
  const ringSize = 12;
  while (cursor < remaining.length) {
    const ringIndex = Math.floor(cursor / ringSize);
    const ringNodes = remaining.slice(cursor, cursor + ringSize + ringIndex * 6);
    const radius = 330 + ringIndex * 260 + Math.min(nodes.length, 80) * 4;

    ringNodes.forEach((node, index) => {
      const angle = (index / Math.max(ringNodes.length, 1)) * Math.PI * 2 - Math.PI / 2 + ringIndex * 0.22;
      positions.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });

    cursor += ringNodes.length;
  }

  return positions;
}

function buildConnectedSet(edges: GraphEdgeData[], selectedNodeId?: string) {
  const connected = new Set<string>();
  if (!selectedNodeId) {
    return connected;
  }

  connected.add(selectedNodeId);
  edges.forEach((edge) => {
    if (edge.source === selectedNodeId) {
      connected.add(edge.target);
    }
    if (edge.target === selectedNodeId) {
      connected.add(edge.source);
    }
  });
  return connected;
}

function buildNodes(
  nodes: KnowledgeGraphNode[],
  edges: GraphEdgeData[],
  typeColorMap: Map<string, string>,
  selectedNodeId?: string,
) {
  const positions = layoutNodes(nodes, edges);
  const connected = buildConnectedSet(edges, selectedNodeId);

  return nodes.map<GraphFlowNode>((node) => {
    const label = typeLabel(node);
    const isConnected = selectedNodeId ? connected.has(node.id) : false;

    return {
      id: node.id,
      type: "graphNode",
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      selected: selectedNodeId === node.id,
      data: {
        graphNode: node,
        typeLabel: label,
        color: typeColorMap.get(label) ?? "#22D3EE",
        isConnected,
        isDimmed: Boolean(selectedNodeId && !isConnected),
      },
    };
  });
}

function buildEdges(edges: GraphEdgeData[], selectedNodeId?: string) {
  return edges.map<Edge>((edge, index) => {
    const connectedToSelected = selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false;
    const dimmed = Boolean(selectedNodeId && !connectedToSelected);
    const color = connectedToSelected ? "#22D3EE" : EDGE_COLORS[index % EDGE_COLORS.length];

    return {
      id: edgeId(edge, index),
      source: edge.source,
      target: edge.target,
      label: edge.label ?? edge.type,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      className: connectedToSelected ? "graph-edge graph-edge-active" : dimmed ? "graph-edge graph-edge-dimmed" : "graph-edge",
      style: {
        stroke: color,
        strokeWidth: connectedToSelected ? 2.8 : 1.6,
        opacity: dimmed ? 0.18 : 0.86,
        filter: connectedToSelected ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 5px ${color}66)`,
        strokeDasharray: connectedToSelected ? "8 8" : "5 9",
      },
      labelStyle: {
        fill: connectedToSelected ? "#ecfeff" : "#d7eaff",
        fontSize: 11,
        fontWeight: 800,
        opacity: dimmed ? 0.3 : 0.95,
        textTransform: "uppercase",
      },
      labelBgStyle: {
        fill: "rgba(5, 7, 10, 0.88)",
        fillOpacity: dimmed ? 0.38 : 0.9,
      },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 8,
    };
  });
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  ({ nodes, edges, typeColorMap, selectedNodeId, onNodeSelect }, ref) => {
    const shellRef = useRef<HTMLDivElement>(null);
    const [instance, setInstance] = useState<ReactFlowInstance<GraphFlowNode, Edge> | null>(null);
    const flowNodes = useMemo(
      () => buildNodes(nodes, edges, typeColorMap, selectedNodeId),
      [edges, nodes, selectedNodeId, typeColorMap],
    );
    const flowEdges = useMemo(() => buildEdges(edges, selectedNodeId), [edges, selectedNodeId]);
    const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(flowNodes);
    const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

    useEffect(() => {
      setNodes((currentNodes) => {
        const currentPositions = new Map(currentNodes.map((node) => [node.id, node.position]));
        return flowNodes.map((node) => ({
          ...node,
          position: currentPositions.get(node.id) ?? node.position,
        }));
      });
    }, [flowNodes, setNodes]);

    useEffect(() => {
      setEdges(flowEdges);
    }, [flowEdges, setEdges]);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => void instance?.zoomIn({ duration: 240 }),
        zoomOut: () => void instance?.zoomOut({ duration: 240 }),
        fitView: () => void instance?.fitView({ padding: 0.24, duration: 600 }),
        fullscreen: () => void shellRef.current?.requestFullscreen?.(),
      }),
      [instance],
    );

    useEffect(() => {
      if (instance && nodes.length > 0) {
        window.requestAnimationFrame(() => {
          void instance.fitView({ padding: 0.24, duration: 650 });
        });
      }
    }, [instance, nodes.length]);

    const handleNodeClick: NodeMouseHandler<GraphFlowNode> = (_event, node) => {
      onNodeSelect(node.id);
    };

    if (nodes.length === 0) {
      return (
        <div ref={shellRef} className="graph-canvas-shell moto-cut-card flex min-h-[620px] items-center justify-center">
          <EmptyState
            icon={Network}
            title="No graph data visible"
            description="No graph data was returned or every node is hidden by the current filters."
          />
        </div>
      );
    }

    return (
      <div ref={shellRef} className="graph-canvas-shell moto-cut-card relative h-[68vh] min-h-[620px] overflow-hidden">
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-carbon-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-glow ring-1 ring-neon-cyan/25 backdrop-blur-xl">
          {nodes.length} visible nodes
        </div>
        <div className="pointer-events-none absolute left-4 top-14 z-10 rounded-full bg-carbon-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-glow ring-1 ring-neon-cyan/25 backdrop-blur-xl">
          {edges.length} relations
        </div>
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          nodeTypes={nodeTypes}
          onInit={setInstance}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.24, duration: 650 }}
          minZoom={0.12}
          maxZoom={2.2}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <Background color="rgba(48, 229, 255, 0.22)" gap={28} size={1.5} variant={BackgroundVariant.Dots} />
          <Controls className="graph-controls" showInteractive={false} />
        </ReactFlow>
      </div>
    );
  },
);

GraphCanvas.displayName = "GraphCanvas";
