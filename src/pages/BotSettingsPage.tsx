import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Save, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { queryClient } from "@/lib/queryClient";
import { botSettingsService } from "@/services/motoaiService";
import type { BotSettings } from "@/types/api";

export function BotSettingsPage() {
  const query = useApiQuery({
    queryKey: ["bot-settings"],
    queryFn: botSettingsService.getSettings,
  });
  const [settings, setSettings] = useState<BotSettings>({});
  const mutation = useMutation({
    mutationFn: botSettingsService.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(["bot-settings"], updated);
    },
  });

  useEffect(() => {
    if (query.data) {
      setSettings(query.data);
    }
  }, [query.data]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(settings);
  }

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader
        eyebrow="Control"
        title="Bot Settings"
        description="Configuration form prepared for your backend settings endpoint."
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.isError && !query.data ? (
        <EmptyState icon={Settings} title="No settings loaded" description="Connect the bot settings endpoint to edit live model and retrieval configuration." />
      ) : null}
      {query.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Runtime Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {mutation.isError ? <div className="mb-4"><ErrorState message={mutation.error.message} /></div> : null}
            <form className="grid gap-5" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-medium">
                System Prompt
                <Textarea
                  value={settings.systemPrompt ?? ""}
                  onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
                  placeholder="Loaded from API"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium">
                  Retrieval Top K
                  <Input
                    type="number"
                    value={settings.retrievalTopK ?? ""}
                    onChange={(event) => setSettings((current) => ({ ...current, retrievalTopK: event.target.value ? Number(event.target.value) : undefined }))}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Temperature
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.temperature ?? ""}
                    onChange={(event) => setSettings((current) => ({ ...current, temperature: event.target.value ? Number(event.target.value) : undefined }))}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Graph Depth
                  <Input
                    type="number"
                    value={settings.graphDepth ?? ""}
                    onChange={(event) => setSettings((current) => ({ ...current, graphDepth: event.target.value ? Number(event.target.value) : undefined }))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-md border border-border bg-graphite-800/45 p-4 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neon-cyan"
                  checked={Boolean(settings.enableCitations)}
                  onChange={(event) => setSettings((current) => ({ ...current, enableCitations: event.target.checked }))}
                />
                Enable citations
              </label>
              <Button type="submit" className="w-full sm:w-fit" disabled={mutation.isPending}>
                <Save className="h-4 w-4" />
                {mutation.isPending ? "Saving..." : "Save settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </motion.section>
  );
}
