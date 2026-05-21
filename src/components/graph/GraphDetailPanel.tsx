import { motion } from "framer-motion";
import { GitFork, Info, Network, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphNodeData, RelationshipDetail } from "@/types/graph";

interface GraphDetailPanelProps {
  selectedNode?: GraphNodeData;
  relationships: RelationshipDetail[];
  onClose: () => void;
}

type PropertyRow = {
  key: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPropertyKey(key: string) {
  return key
    .split(".")
    .map((part) =>
      part
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(" / ");
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return String(value);
}

function flattenProperties(properties: Record<string, unknown>, prefix = ""): PropertyRow[] {
  return Object.entries(properties).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (isRecord(value)) {
      return flattenProperties(value, nextKey);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [{ key: nextKey, value: "-" }];
      }

      if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
        return [{ key: nextKey, value: value.map(formatPropertyValue).join(", ") }];
      }

      return value.flatMap((item, index) => {
        const itemKey = `${nextKey}.${index + 1}`;
        return isRecord(item) ? flattenProperties(item, itemKey) : [{ key: itemKey, value: formatPropertyValue(item) }];
      });
    }

    return [{ key: nextKey, value: formatPropertyValue(value) }];
  });
}

function PropertiesBlock({ properties }: { properties?: Record<string, unknown> }) {
  if (!properties || Object.keys(properties).length === 0) {
    return null;
  }

  const rows = flattenProperties(properties);

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Properties</p>
      <dl className="overflow-hidden rounded-[14px] bg-carbon-950/70 text-sm shadow-inner ring-1 ring-neon-cyan/20">
        {rows.map((row, index) => (
          <div
            key={`${row.key}-${index}`}
            className="grid gap-1 border-b border-white/10 px-3 py-3 last:border-b-0"
          >
            <dt className="text-[0.68rem] font-black uppercase tracking-wider text-muted-foreground">{formatPropertyKey(row.key)}</dt>
            <dd className="break-words font-semibold leading-6 text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RelationshipCard({ relationship }: { relationship: RelationshipDetail }) {
  const label = relationship.edge.label ?? relationship.edge.type ?? "related";

  return (
    <div className="rounded-[14px] bg-graphite-800/45 p-3 text-sm shadow-showroom ring-1 ring-white/10">
      <div className="flex items-start gap-2">
        <GitFork className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
        <div className="min-w-0">
          <p className="break-words font-semibold text-foreground">
            {relationship.source?.label ?? relationship.edge.source}
            <span className="px-2 text-neon-cyan">-&gt;</span>
            <span className="text-neon-cyan">{label}</span>
            <span className="px-2 text-neon-cyan">-&gt;</span>
            {relationship.target?.label ?? relationship.edge.target}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GraphDetailPanel({ selectedNode, relationships, onClose }: GraphDetailPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="carbon-panel hidden h-full min-h-[420px] rounded-[18px] p-6 text-center xl:flex xl:flex-col xl:items-center xl:justify-center">
        <Network className="mb-3 h-9 w-9 text-neon-cyan" />
        <h2 className="text-lg font-bold">Select a graph node</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Click a glowing node to inspect its API details and live relationships.</p>
      </aside>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ duration: 0.22 }}
      className="graph-detail-panel h-full min-h-[420px] overflow-y-auto rounded-[18px] p-4"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-neon-cyan" />
          <p className="text-xs font-bold uppercase tracking-wider text-neon-cyan">Node Details</p>
        </div>
        <Button aria-label="Close details" size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-2xl font-black text-foreground neon-text">{selectedNode.label}</h2>
            <Badge>{selectedNode.type || "Unknown"}</Badge>
          </div>
          {selectedNode.description ? <p className="text-sm leading-6 text-muted-foreground">{selectedNode.description}</p> : null}
        </div>

        <PropertiesBlock properties={selectedNode.properties} />

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Connected Relationships
          </p>
          <div className="space-y-2">
            {relationships.length > 0 ? (
              relationships.map((relationship, index) => (
                <RelationshipCard
                  key={relationship.edge.id ?? `${relationship.edge.source}-${relationship.edge.target}-${index}`}
                  relationship={relationship}
                />
              ))
            ) : (
              <p className="rounded-[14px] bg-carbon-950/70 p-3 text-sm text-muted-foreground ring-1 ring-white/10">
                No visible relationships for this node.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
