import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GitFork, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRelationsFromGraph } from "@/hooks/useGraph";
import type { GraphEdgeData, GraphNodeData } from "@/types/graph";

function edgeKey(edge: GraphEdgeData, index: number) {
  return edge.id ?? `${edge.source}-${edge.target}-${index}`;
}

function relationLabel(edge: GraphEdgeData) {
  return edge.label?.trim() || edge.type?.trim() || "related";
}

function nodeLabel(nodeById: Map<string, GraphNodeData>, id: string) {
  return nodeById.get(id)?.label ?? id;
}

function propertiesPreview(properties?: Record<string, unknown>) {
  if (!properties || Object.keys(properties).length === 0) {
    return "";
  }

  return Object.entries(properties)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}`)
    .join(", ");
}

export function RelationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const query = useRelationsFromGraph();
  const graph = query.data;
  const relations = graph?.edges ?? [];
  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.id, node])), [graph?.nodes]);
  const visibleRelations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return relations;
    }

    return relations.filter((relation) => {
      const source = nodeLabel(nodeById, relation.source);
      const target = nodeLabel(nodeById, relation.target);
      const searchText = `${source} ${relationLabel(relation)} ${target} ${relation.type ?? ""}`.toLowerCase();
      return searchText.includes(normalizedSearch);
    });
  }, [nodeById, relations, searchTerm]);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader
        eyebrow="Knowledge Base"
        title="Relations"
        description="Inspect source-target relationships returned by your graph service."
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.isError && relations.length === 0 ? (
        <EmptyState icon={GitFork} title="No relations found" description="Graph relationships will appear here when the API starts returning relation data." />
      ) : null}
      {relations.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-carbon-950/80 p-4 shadow-showroom backdrop-blur-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search relations by source, label, target, or type..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          {visibleRelations.length === 0 ? (
            <EmptyState icon={GitFork} title="No matching relations" description="Adjust search to show graph edges." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-border bg-carbon-950/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Source</th>
                      <th className="px-5 py-4">Relation / Label</th>
                      <th className="px-5 py-4">Target</th>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4">Properties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRelations.map((relation, index) => (
                      <tr key={edgeKey(relation, index)} className="border-b border-border/70 transition hover:bg-graphite-800/35">
                        <td className="px-5 py-4 font-semibold">{nodeLabel(nodeById, relation.source)}</td>
                        <td className="px-5 py-4">
                          <Badge>{relationLabel(relation)}</Badge>
                        </td>
                        <td className="px-5 py-4 font-semibold">{nodeLabel(nodeById, relation.target)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{relation.type ?? ""}</td>
                        <td className="max-w-[360px] truncate px-5 py-4 text-muted-foreground">{propertiesPreview(relation.properties)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </motion.section>
  );
}
