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
  isFeatured?: boolean;
  onSelect: () => void;
}

export function GraphNode({ graphNode, typeLabel, color, isSelected, isConnected, isDimmed, isFeatured = false, onSelect }: GraphNodeProps) {
  return (
    <button
      type="button"
      className={cn(
        "graph-neon-node relative flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-center transition duration-200",
        isFeatured && "h-24 w-24 border-[4px]",
        isSelected && "graph-neon-node-selected",
        isConnected && !isSelected && "graph-neon-node-connected",
        isDimmed && "opacity-35 saturate-50",
      )}
      style={
        {
          "--node-color": color,
          borderColor: color,
          boxShadow: isFeatured
            ? `0 18px 40px ${color}70, 0 0 0 7px ${color}38, 0 0 56px ${color}8a, inset 0 0 28px ${color}36`
            : `0 10px 24px ${color}38, 0 0 0 4px ${color}18, inset 0 0 22px ${color}18`,
        } as CSSProperties
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
    >
      {isFeatured ? (
        <div
          className="pointer-events-none absolute -inset-2 rounded-full border-2"
          style={{
            background: `radial-gradient(circle, ${color}32 0%, transparent 68%)`,
            borderColor: `${color}80`,
            boxShadow: `0 0 38px ${color}90`,
          }}
        />
      ) : null}
      <div
        className={cn("absolute rounded-full border", isFeatured ? "inset-1 bg-sky-500" : "inset-2 bg-white/88")}
        style={{
          background: isFeatured ? `linear-gradient(135deg, ${color}, #60A5FA)` : undefined,
          borderColor: isFeatured ? "rgba(255,255,255,0.92)" : `${color}66`,
        }}
      />
      <div className={cn("pointer-events-none relative z-10 px-1.5", isFeatured ? "max-w-[5.5rem]" : "max-w-[4.75rem]")}>
        <p className={cn("line-clamp-2 font-black leading-tight text-slate-950", isFeatured ? "text-xs" : "text-[11px]")}>{graphNode.label}</p>
        <p className="mt-1 truncate text-[9px] font-black uppercase tracking-wider text-slate-950">{typeLabel}</p>
      </div>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.42),transparent_58%)] opacity-75" />
    </button>
  );
}
