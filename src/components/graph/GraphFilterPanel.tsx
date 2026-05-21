import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GraphFilterPanelProps {
  nodeTypes: string[];
  selectedTypes: Set<string>;
  typeColorMap: Map<string, string>;
  onTypeToggle: (type: string) => void;
  onReset: () => void;
}

export function GraphFilterPanel({
  nodeTypes,
  selectedTypes,
  typeColorMap,
  onTypeToggle,
  onReset,
}: GraphFilterPanelProps) {
  return (
    <div className="carbon-panel flex flex-wrap items-center gap-1.5 rounded-[18px] px-3 py-2">
      <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Node Types</span>
      {nodeTypes.map((type) => {
        const selected = selectedTypes.has(type);
        const color = typeColorMap.get(type) ?? "#22D3EE";

        return (
          <motion.button
            key={type}
            type="button"
            whileHover={{ y: -1, scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onTypeToggle(type)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition",
              selected ? "text-foreground" : "border-border bg-graphite-800/40 text-muted-foreground opacity-70",
            )}
            style={
              selected
                ? {
                    borderColor: `${color}aa`,
                    backgroundColor: `${color}18`,
                    boxShadow: `0 0 18px ${color}33`,
                  }
                : undefined
            }
          >
            {type}
          </motion.button>
        );
      })}
      <Button className="ml-auto h-7 px-2.5 text-xs" variant="secondary" onClick={onReset}>
        <RotateCcw className="h-3 w-3" />
        Reset Filters
      </Button>
    </div>
  );
}
