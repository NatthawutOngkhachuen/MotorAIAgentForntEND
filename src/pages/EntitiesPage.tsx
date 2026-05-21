import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEntitiesFromGraph } from "@/hooks/useGraph";
import type { GraphNodeData } from "@/types/graph";

function getNodeType(node: GraphNodeData) {
  return node.type?.trim() || "Unknown";
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

export function EntitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const query = useEntitiesFromGraph();
  const entities = useMemo(() => query.data ?? [], [query.data]);
  const nodeTypes = useMemo(() => Array.from(new Set(entities.map(getNodeType))).sort(), [entities]);
  const visibleEntities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return entities.filter((entity) => {
      const type = getNodeType(entity);
      const searchText = `${entity.label} ${type}`.toLowerCase();
      return (selectedType === "all" || selectedType === type) && (!normalizedSearch || searchText.includes(normalizedSearch));
    });
  }, [entities, searchTerm, selectedType]);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader
        title="Entities"
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.isError && entities.length === 0 ? (
        <EmptyState icon={Gauge} title="No entities found" description="Entity rows will appear here after your API returns graph entities." />
      ) : null}
      {entities.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-carbon-950/80 p-4 shadow-showroom backdrop-blur-xl md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search entities by name or type..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <select
              className="h-11 rounded-md border border-border bg-carbon-900 px-3 text-sm text-foreground outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="all">All types</option>
              {nodeTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {visibleEntities.length === 0 ? (
            <EmptyState icon={Gauge} title="No matching entities" description="Adjust search or type filters to show graph nodes." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-border bg-carbon-950/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Label / Name</th>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4">Description</th>
                      <th className="px-5 py-4">Properties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntities.map((entity) => (
                      <tr key={entity.id} className="border-b border-border/70 transition hover:bg-graphite-800/35">
                        <td className="px-5 py-4 font-semibold">{entity.label}</td>
                        <td className="px-5 py-4">
                          <Badge>{getNodeType(entity)}</Badge>
                        </td>
                        <td className="max-w-[320px] px-5 py-4 text-muted-foreground">{entity.description ?? ""}</td>
                        <td className="max-w-[360px] truncate px-5 py-4 text-muted-foreground">{propertiesPreview(entity.properties)}</td>
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
