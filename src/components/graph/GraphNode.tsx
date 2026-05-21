import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { GraphNodeData as KnowledgeGraphNode } from "@/types/graph";

interface GraphNodeProps {
  graphNode: KnowledgeGraphNode;
  typeLabel: string;
  color: string;
  isSelected: boolean;
  isConnected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}

export function GraphNode({ graphNode, typeLabel, color, isSelected, isConnected, isDimmed, onSelect }: GraphNodeProps) {
  return (
    <button
      type="button"
      className={cn(
        "graph-neon-node relative flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-center transition duration-200",
        isSelected && "graph-neon-node-selected",
        isConnected && !isSelected && "graph-neon-node-connected",
        isDimmed && "opacity-35 saturate-50",
      )}
      style={
        {
          "--node-color": color,
          borderColor: color,
          boxShadow: `0 10px 24px ${color}38, 0 0 0 4px ${color}18, inset 0 0 22px ${color}18`,
        } as CSSProperties
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
    >
      <div className="absolute inset-2 rounded-full border bg-white/88" style={{ borderColor: `${color}66` }} />
      <div className="pointer-events-none relative z-10 max-w-[4.5rem] px-1.5">
        <p className="line-clamp-2 text-[10px] font-black leading-tight text-slate-950">{graphNode.label}</p>
        <p className="mt-1 truncate text-[8px] font-bold uppercase tracking-wider text-slate-600">{typeLabel}</p>
      </div>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.42),transparent_58%)] opacity-75" />
    </button>
  );
}
