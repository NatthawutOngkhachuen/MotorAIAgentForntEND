import { memo } from "react";
import { AlertTriangle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedChatMessage } from "@/services/chatService";

interface ChatMessageProps {
  message: NormalizedChatMessage;
}

function formatResponseTime(durationMs: number) {
  const totalSeconds = Math.max(0, durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secondsText = seconds >= 10 || minutes > 0 ? seconds.toFixed(0) : seconds.toFixed(1);

  if (minutes > 0) {
    return `ตอบใน ${minutes} นาที ${secondsText} วินาที`;
  }

  return `ตอบใน ${secondsText} วินาที`;
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "relative max-w-[88%] overflow-hidden px-4 py-3 shadow-showroom backdrop-blur-xl sm:max-w-[75%]",
          isUser
            ? "rounded-[18px_8px_18px_18px] bg-gradient-to-br from-blue-700 via-blue-600 to-neon-cyan text-primary-foreground shadow-glow ring-1 ring-neon-cyan/35 md:max-w-[70%]"
            : "rounded-[8px_18px_18px_18px] bg-graphite-900/90 ai-glow md:max-w-[75%]",
        )}
      >
        {!isUser ? <span className="absolute inset-y-3 left-0 w-1 bg-gradient-to-b from-neon-cyan to-transparent" /> : null}
        {isUser ? <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/45 to-transparent" /> : null}
        {!isUser ? (
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
            <Bot className="h-4 w-4" />
            ASSISTANT
          </div>
        ) : null}
        <p className={cn("whitespace-pre-wrap break-words text-base leading-7", isUser ? "text-white" : "text-foreground")}>{message.content}</p>
        {!isUser && typeof message.responseTimeMs === "number" ? (
          <p className="mt-3 text-xs font-medium text-muted-foreground">{formatResponseTime(message.responseTimeMs)}</p>
        ) : null}
      </article>
    </div>
  );
});

interface CompactChatErrorProps {
  message: string;
  onRetry?: () => void;
}

export function CompactChatError({ message, onRetry }: CompactChatErrorProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-full items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span className="whitespace-pre-wrap break-words text-muted-foreground">{message}</span>
        {onRetry ? (
          <button type="button" className="ml-2 shrink-0 text-xs font-bold uppercase tracking-wide text-neon-cyan" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="relative max-w-[88%] overflow-hidden rounded-[8px_18px_18px_18px] bg-graphite-900/90 px-4 py-3 shadow-glow ring-1 ring-neon-cyan/25 backdrop-blur-xl sm:max-w-[75%]">
        <span className="absolute inset-y-3 left-0 w-1 bg-gradient-to-b from-neon-cyan to-transparent" />
        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-neon-cyan">
          <Bot className="h-4 w-4" />
          ASSISTANT
        </div>
        <div className="flex items-center gap-3 text-base text-muted-foreground">
          <span>MotoAI is thinking...</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan"
                style={{ animationDelay: `${dot * 160}ms` }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
