import { motion } from "framer-motion";
import { Activity, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStatsFromGraph, useGraph } from "@/hooks/useGraph";

export function AdminDashboardPage() {
  const graphQuery = useGraph();
  const statsQuery = useDashboardStatsFromGraph();
  const query = statsQuery;
  const graph = graphQuery.data;
  const stats = statsQuery.data;
  const isGraphEmpty = (graph?.nodes.length ?? 0) === 0 && (graph?.edges.length ?? 0) === 0;
  const metrics = stats
    ? [
        { id: "total-entities", label: "Total Entities", value: stats.totalEntities, trend: "Derived from graph.nodes.length" },
        { id: "total-relations", label: "Total Relations", value: stats.totalRelations, trend: "Derived from graph.edges.length" },
        { id: "node-types", label: "Node Types", value: stats.nodeTypes, trend: "Unique node.type values" },
        { id: "relation-types", label: "Relation Types", value: stats.relationTypes, trend: "Unique edge label/type values" },
        { id: "unknown-nodes", label: "Unknown Nodes", value: stats.unknownNodes, trend: "Missing or Unknown node types" },
        { id: "connected-nodes", label: "Connected Nodes", value: stats.connectedNodes, trend: "Nodes appearing in at least one edge" },
        { id: "isolated-nodes", label: "Isolated Nodes", value: stats.isolatedNodes, trend: "Entities without graph connections" },
      ]
    : [];

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        description="Operational telemetry for MotoAI conversations, GraphRAG retrieval, knowledge graph health, and sales workflows once your backend is connected."
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.isError && isGraphEmpty ? (
        <EmptyState icon={BarChart3} title="No graph metrics yet" description="Graph-derived dashboard metrics will appear after the graph endpoint returns nodes or edges." />
      ) : null}
      {!isGraphEmpty && metrics.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <Card
              key={metric.id}
              className={index === 0 ? "relative overflow-hidden ai-glow xl:col-span-2" : "relative overflow-hidden hover:shadow-glow"}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-neon-cyan" />
              <div className="ai-light-sheen opacity-30" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</CardTitle>
                <div className="grid h-8 w-8 place-items-center rounded-md bg-neon-cyan/10 text-neon-cyan ring-1 ring-neon-cyan/20">
                  <Activity className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black tracking-tight text-foreground">{metric.value}</p>
                {metric.trend ? <p className="mt-2 text-xs text-neon-cyan">{metric.trend}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}
