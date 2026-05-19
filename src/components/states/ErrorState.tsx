import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({ title = "Unable to load data", message, action, onRetry }: ErrorStateProps) {
  return (
    <Card className="border-destructive/35 bg-destructive/8">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : (
          action
        )}
      </CardContent>
    </Card>
  );
}
