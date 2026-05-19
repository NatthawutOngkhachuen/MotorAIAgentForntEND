import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, icon: Icon = Sparkles }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-neon-cyan/25 bg-graphite-900/55">
      <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-neon-cyan/30 bg-neon-cyan/10 shadow-glow">
          <Icon className="h-7 w-7 text-neon-cyan" />
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
