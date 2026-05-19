import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphNodeData as KnowledgeGraphNode } from "@/types/graph";

export type FlowGraphNodeData = {
  graphNode: KnowledgeGraphNode;
  typeLabel: string;
  color: string;
  isConnected: boolean;
  isDimmed: boolean;
};

export type GraphFlowNode = Node<FlowGraphNodeData, "graphNode">;

export function GraphNode({ data, selected }: NodeProps<GraphFlowNode>) {
  return (
    <div
      className={cn(
        "graph-neon-node relative flex h-32 w-32 items-center justify-center rounded-full border text-center backdrop-blur-xl transition duration-300",
        selected && "graph-neon-node-selected",
        data.isConnected && !selected && "graph-neon-node-connected",
        data.isDimmed && "opacity-35 saturate-50",
      )}
      style={
        {
          "--node-color": data.color,
          borderColor: data.color,
          boxShadow: `0 0 20px ${data.color}5c, inset 0 0 22px ${data.color}16`,
        } as CSSProperties
      }
    >
      <Handle className="!h-2 !w-2 !border-0 !bg-transparent" type="target" position={Position.Top} />
      <div className="absolute inset-3 rounded-full border border-border bg-carbon-950/80" />
      <div className="pointer-events-none relative z-10 max-w-[6.5rem] px-2">
        <p className="line-clamp-2 text-sm font-black leading-tight text-foreground drop-shadow">{data.graphNode.label}</p>
        <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{data.typeLabel}</p>
      </div>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_58%)] opacity-30" />
      <Handle className="!h-2 !w-2 !border-0 !bg-transparent" type="source" position={Position.Bottom} />
    </div>
  );
}
