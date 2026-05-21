import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Maximize2, Minus, Network, Plus } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { GraphNode } from "@/components/graph/GraphNode";
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
  featuredTypeLabels?: Set<string>;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
}

type Point = { x: number; y: number };
type Transform = { x: number; y: number; zoom: number };

const NODE_SIZE = 80;
const MIN_ZOOM = 0.24;
const MAX_ZOOM = 2.2;
const EDGE_COLOR = "#0369A1";
const FOCUSED_EDGE_COLOR = "#111827";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
    return new Map<string, Point>();
  }

  const degree = buildDegreeMap(nodes, edges);
  const centerNode = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label))[0];
  const positions = new Map<string, Point>();
  positions.set(centerNode.id, { x: 0, y: 0 });

  const remaining = nodes
    .filter((node) => node.id !== centerNode.id)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label));

  let cursor = 0;
  let ringIndex = 0;
  const ringSize = 14;
  while (cursor < remaining.length) {
    const ringNodes = remaining.slice(cursor, cursor + ringSize + ringIndex * 8);
    const radius = 180 + ringIndex * 112 + Math.min(nodes.length, 80) * 0.8;

    ringNodes.forEach((node, index) => {
      const angle = (index / Math.max(ringNodes.length, 1)) * Math.PI * 2 - Math.PI / 2 + ringIndex * 0.22;
      positions.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });

    cursor += ringNodes.length;
    ringIndex += 1;
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

function getBounds(positions: Map<string, Point>) {
  const points = [...positions.values()];
  if (points.length === 0) {
    return { minX: -NODE_SIZE, maxX: NODE_SIZE, minY: -NODE_SIZE, maxY: NODE_SIZE };
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x - NODE_SIZE),
      maxX: Math.max(bounds.maxX, point.x + NODE_SIZE),
      minY: Math.min(bounds.minY, point.y - NODE_SIZE),
      maxY: Math.max(bounds.maxY, point.y + NODE_SIZE),
    }),
    {
      minX: points[0].x - NODE_SIZE,
      maxX: points[0].x + NODE_SIZE,
      minY: points[0].y - NODE_SIZE,
      maxY: points[0].y + NODE_SIZE,
    },
  );
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  ({ nodes, edges, typeColorMap, featuredTypeLabels, selectedNodeId, onNodeSelect }, ref) => {
    const shellRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const positions = useMemo(() => layoutNodes(nodes, edges), [edges, nodes]);
    const connected = useMemo(() => buildConnectedSet(edges, selectedNodeId), [edges, selectedNodeId]);
    const selectedEdges = useMemo(
      () => (selectedNodeId ? edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId) : []),
      [edges, selectedNodeId],
    );
    const displayEdges = selectedNodeId ? selectedEdges : edges;
    const graphLayoutKey = useMemo(
      () => `${nodes.map((node) => node.id).join("|")}::${edges.map((edge, index) => edgeId(edge, index)).join("|")}`,
      [edges, nodes],
    );
    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });

    const fitView = useCallback(() => {
      const shell = shellRef.current;
      if (!shell || nodes.length === 0) {
        return;
      }

      const bounds = getBounds(positions);
      const width = Math.max(bounds.maxX - bounds.minX, 1);
      const height = Math.max(bounds.maxY - bounds.minY, 1);
      const padding = 36;
      const zoom = clamp(Math.min((shell.clientWidth - padding * 2) / width, (shell.clientHeight - padding * 2) / height), MIN_ZOOM, 1.35);
      const centerX = bounds.minX + width / 2;
      const centerY = bounds.minY + height / 2;

      setTransform({
        x: shell.clientWidth / 2 - centerX * zoom,
        y: shell.clientHeight / 2 - centerY * zoom,
        zoom,
      });
    }, [nodes.length, positions]);

    const zoomBy = useCallback((factor: number) => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      setTransform((current) => {
        const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const centerX = shell.clientWidth / 2;
        const centerY = shell.clientHeight / 2;
        const worldX = (centerX - current.x) / current.zoom;
        const worldY = (centerY - current.y) / current.zoom;

        return {
          x: centerX - worldX * nextZoom,
          y: centerY - worldY * nextZoom,
          zoom: nextZoom,
        };
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => zoomBy(1.18),
        zoomOut: () => zoomBy(1 / 1.18),
        fitView,
        fullscreen: () => void shellRef.current?.requestFullscreen?.(),
      }),
      [fitView, zoomBy],
    );

    useEffect(() => {
      fitView();
    }, [fitView, graphLayoutKey]);

    useEffect(() => {
      const shell = shellRef.current;
      if (!shell) {
        return undefined;
      }

      const observer = new ResizeObserver(() => fitView());
      observer.observe(shell);
      return () => observer.disconnect();
    }, [fitView]);

    useEffect(() => {
      const shell = shellRef.current;
      if (!shell) {
        return undefined;
      }

      const stopPageScroll = (event: globalThis.WheelEvent) => {
        event.preventDefault();
      };

      shell.addEventListener("wheel", stopPageScroll, { passive: false });
      return () => shell.removeEventListener("wheel", stopPageScroll);
    }, []);

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }

      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
      setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
      event.preventDefault();
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const rect = shell.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      setTransform((current) => {
        const nextZoom = clamp(current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
        const worldX = (pointerX - current.x) / current.zoom;
        const worldY = (pointerY - current.y) / current.zoom;

        return {
          x: pointerX - worldX * nextZoom,
          y: pointerY - worldY * nextZoom,
          zoom: nextZoom,
        };
      });
    }

    if (nodes.length === 0) {
      return (
        <div ref={shellRef} className="graph-canvas-shell flex h-full min-h-[420px] items-center justify-center">
          <EmptyState
            icon={Network}
            title="No graph data visible"
            description="No graph data was returned or every node is hidden by the current filters."
          />
        </div>
      );
    }

    return (
      <div
        ref={shellRef}
        className="graph-canvas-shell relative h-full min-h-[420px] cursor-grab touch-none overflow-hidden overscroll-contain active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-carbon-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-glow ring-1 ring-neon-cyan/25 backdrop-blur-xl">
          {nodes.length} visible nodes
        </div>
        <div className="pointer-events-none absolute left-4 top-14 z-10 rounded-full bg-carbon-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-glow ring-1 ring-neon-cyan/25 backdrop-blur-xl">
          {edges.length} relations
        </div>

        <div className="graph-world absolute left-0 top-0" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible">
            <defs>
              <marker id="graph-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
                <path d="M0,0 L7,3.5 L0,7 Z" fill={FOCUSED_EDGE_COLOR} />
              </marker>
            </defs>
            {displayEdges.map((edge, index) => {
              const source = positions.get(edge.source);
              const target = positions.get(edge.target);
              if (!source || !target) {
                return null;
              }

              const isFocused = Boolean(selectedNodeId);
              const label = edge.label ?? edge.type;
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;

              return (
                <g key={edgeId(edge, index)} className={isFocused ? "graph-focused-edge" : "graph-overview-edge"}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    markerEnd={isFocused ? "url(#graph-arrow)" : undefined}
                    stroke={isFocused ? FOCUSED_EDGE_COLOR : EDGE_COLOR}
                    strokeDasharray={isFocused ? "8 8" : undefined}
                    strokeLinecap="round"
                    strokeWidth={isFocused ? "2.8" : "1.15"}
                  />
                  {isFocused && label ? (
                    <text x={midX} y={midY} fill="#0f172a" fontSize="13" fontWeight="900" paintOrder="stroke" stroke="rgba(255,255,255,0.92)" strokeWidth="5" textAnchor="middle">
                      {label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const label = typeLabel(node);
            const position = positions.get(node.id) ?? { x: 0, y: 0 };
            const isConnected = selectedNodeId ? connected.has(node.id) : false;
            const isFeatured = featuredTypeLabels?.has(label) ?? false;

            return (
              <div key={node.id} style={{ left: position.x, top: position.y, zIndex: isFeatured ? 4 : 1 }} className="absolute">
                <GraphNode
                  graphNode={node}
                  typeLabel={label}
                  color={typeColorMap.get(label) ?? EDGE_COLOR}
                  isFeatured={isFeatured}
                  isSelected={selectedNodeId === node.id}
                  isConnected={isConnected}
                  isDimmed={Boolean(selectedNodeId && !isConnected)}
                  onSelect={() => onNodeSelect(node.id)}
                />
              </div>
            );
          })}
        </div>

        <div className="graph-controls absolute bottom-4 left-4 z-10 grid overflow-hidden rounded-md border border-border bg-carbon-950/90 shadow-showroom backdrop-blur-xl">
          <button type="button" aria-label="Zoom in" className="grid h-9 w-9 place-items-center border-b border-border text-foreground hover:bg-neon-cyan/10" onClick={() => zoomBy(1.18)}>
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Zoom out" className="grid h-9 w-9 place-items-center border-b border-border text-foreground hover:bg-neon-cyan/10" onClick={() => zoomBy(1 / 1.18)}>
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Fit graph" className="grid h-9 w-9 place-items-center border-b border-border text-foreground hover:bg-neon-cyan/10" onClick={fitView}>
            <Network className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Fullscreen graph" className="grid h-9 w-9 place-items-center text-foreground hover:bg-neon-cyan/10" onClick={() => shellRef.current?.requestFullscreen?.()}>
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  },
);

GraphCanvas.displayName = "GraphCanvas";
