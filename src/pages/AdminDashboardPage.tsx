import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, AlertCircle, BarChart3, CircleDot, GitFork, Network, Sparkles, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { useDashboardStatsFromGraph, useGraph } from "@/hooks/useGraph";
import type { GraphEdgeData, GraphNodeData, KnowledgeGraphData } from "@/types/graph";

const CHART_COLORS = ["#0891B2", "#1D4ED8", "#0284C7", "#6D28D9", "#2563EB"];

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function nodeType(node: GraphNodeData) {
  return node.type?.trim() || "Unknown";
}

function relationType(edge: GraphEdgeData) {
  return edge.label?.trim() || edge.type?.trim() || "Unknown";
}

function topCounts(values: string[], limit = 5) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function topConnectedNodes(graph: KnowledgeGraphData, limit = 5) {
  const degree = new Map<string, number>();
  graph.nodes.forEach((node) => degree.set(node.id, 0));
  graph.edges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  });

  return graph.nodes
    .map((node) => ({ node, value: degree.get(node.id) ?? 0 }))
    .sort((a, b) => b.value - a.value || a.node.label.localeCompare(b.node.label))
    .slice(0, limit);
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-sky-100 bg-white shadow-[0_14px_36px_rgba(8,145,178,0.06)] ${className}`}>{children}</section>;
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>
    </Panel>
  );
}

function CompactBarChart({ title, items, total }: { title: string; items: Array<{ label: string; value: number }>; total: number }) {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0 text-sky-600" />
          <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-cyan-700 ring-1 ring-sky-100">{formatNumber(total)}</span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const width = Math.max(percent(item.value, total), 2);
          const color = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-slate-700">{item.label}</p>
                <p className="shrink-0 text-sm font-semibold text-slate-900">{formatNumber(item.value)}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-sky-50 ring-1 ring-sky-100">
                <div className="h-full rounded-full shadow-[0_0_18px_rgba(14,165,233,0.22)]" style={{ width: `${width}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HealthPanel({
  connectedPercent,
  isolatedPercent,
  connectedNodes,
  isolatedNodes,
}: {
  connectedPercent: number;
  isolatedPercent: number;
  connectedNodes: number;
  isolatedNodes: number;
}) {
  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-700">
            <TrendingUp className="h-5 w-5" />
            <p className="text-sm font-medium uppercase tracking-[0.08em]">Graph Health</p>
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{connectedPercent}% connected</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">ภาพรวมความเชื่อมโยงของโหนดทั้งหมดในระบบ ใช้ดูว่าข้อมูลพร้อมนำไปวิเคราะห์ต่อแค่ไหน</p>
        </div>
        <div className="rounded-lg bg-sky-50 px-4 py-3 text-cyan-700 ring-1 ring-sky-100">
          <p className="text-xs font-medium uppercase tracking-wide">Good Links</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(connectedNodes)}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-500">
          <span>Connected</span>
          <span>{connectedPercent}%</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-sky-50 ring-1 ring-sky-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${connectedPercent}%`,
              background: "linear-gradient(90deg, #0891B2 0%, #1D4ED8 55%, #6D28D9 100%)",
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-cyan-700 ring-1 ring-sky-100">{formatNumber(connectedNodes)} connected nodes</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">{formatNumber(isolatedNodes)} isolated nodes</span>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 ring-1 ring-violet-100">{isolatedPercent}% needs review</span>
        </div>
      </div>
    </Panel>
  );
}

export function AdminDashboardPage() {
  const graphQuery = useGraph();
  const statsQuery = useDashboardStatsFromGraph();
  const graph = graphQuery.data;
  const stats = statsQuery.data;
  const isGraphEmpty = (graph?.nodes.length ?? 0) === 0 && (graph?.edges.length ?? 0) === 0;

  const dashboard = useMemo(() => {
    if (!graph || !stats) {
      return undefined;
    }

    return {
      connectedPercent: percent(stats.connectedNodes, stats.totalEntities),
      isolatedPercent: percent(stats.isolatedNodes, stats.totalEntities),
      density: stats.totalEntities > 0 ? (stats.totalRelations / stats.totalEntities).toFixed(1) : "0.0",
      nodeTypes: topCounts(graph.nodes.map(nodeType)),
      relationTypes: topCounts(graph.edges.map(relationType)),
      connectedNodes: topConnectedNodes(graph),
    };
  }, [graph, stats]);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-white via-sky-50/80 to-cyan-50/70 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-cyan-700">Admin Overview</p>
            <h1 className="mt-1 text-4xl font-semibold leading-none tracking-tight text-slate-900">Dashboard</h1>
          </div>
          {stats && dashboard ? (
            <div className="grid gap-3 sm:grid-cols-3 md:w-[34rem]">
              <div className="rounded-lg border border-sky-100 bg-white/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Health</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-700">{dashboard.connectedPercent}%</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Review</p>
                <p className="mt-1 text-2xl font-semibold text-blue-700">{dashboard.isolatedPercent}%</p>
              </div>
              <div className="rounded-lg border border-violet-100 bg-white/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Density</p>
                <p className="mt-1 text-2xl font-semibold text-violet-700">{dashboard.density}x</p>
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      {statsQuery.isLoading ? <LoadingState /> : null}
      {statsQuery.isError ? <ErrorState message={statsQuery.error.message} onRetry={() => statsQuery.refetch()} /> : null}
      {!statsQuery.isLoading && !statsQuery.isError && isGraphEmpty ? (
        <EmptyState icon={BarChart3} title="No graph metrics yet" description="Graph metrics will appear after the graph endpoint returns nodes or edges." />
      ) : null}

      {!isGraphEmpty && stats && dashboard ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <MetricTile
              label="Entities"
              value={formatNumber(stats.totalEntities)}
              hint={`${formatNumber(stats.nodeTypes)} node categories`}
              icon={CircleDot}
              tone="bg-sky-50 text-cyan-700 ring-1 ring-sky-100"
            />
            <MetricTile
              label="Relations"
              value={formatNumber(stats.totalRelations)}
              hint={`${dashboard.density} links per entity`}
              icon={GitFork}
              tone="bg-blue-50 text-blue-700 ring-1 ring-blue-100"
            />
            <MetricTile
              label="Connected"
              value={`${dashboard.connectedPercent}%`}
              hint={`${formatNumber(stats.connectedNodes)} nodes linked`}
              icon={Network}
              tone="bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
            />
            <MetricTile
              label="Need Review"
              value={formatNumber(stats.isolatedNodes + stats.unknownNodes)}
              hint="Isolated or unknown records"
              icon={AlertCircle}
              tone="bg-violet-50 text-violet-700 ring-1 ring-violet-100"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CompactBarChart title="Node Mix" items={dashboard.nodeTypes} total={stats.totalEntities} />
            <CompactBarChart title="Relation Mix" items={dashboard.relationTypes} total={stats.totalRelations} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <HealthPanel
                connectedPercent={dashboard.connectedPercent}
                isolatedPercent={dashboard.isolatedPercent}
                connectedNodes={stats.connectedNodes}
                isolatedNodes={stats.isolatedNodes}
              />
            </div>

            <Panel className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-700" />
                <h2 className="text-lg font-semibold text-slate-900">Key Nodes</h2>
              </div>
              <div className="space-y-2.5">
                {dashboard.connectedNodes.map((item, index) => (
                  <div key={item.node.id} className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-medium text-cyan-700 ring-1 ring-sky-100">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{item.node.label}</p>
                      <p className="truncate text-sm text-slate-500">{nodeType(item.node)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cyan-700 px-2.5 py-1 text-center text-sm font-medium text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
