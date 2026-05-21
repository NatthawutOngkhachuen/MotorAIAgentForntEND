import { memo, type ReactNode } from "react";
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

type ChatContentBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

function parsePipeCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isPipeTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && parsePipeCells(trimmed).length > 1;
}

function isTableSeparator(line: string) {
  if (!isPipeTableRow(line)) {
    return false;
  }

  return parsePipeCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function readBulletText(line: string) {
  const match = line.trim().match(/^[-*•]\s+(.+)$/);
  return match?.[1].trim();
}

function parseAssistantContent(content: string): ChatContentBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ChatContentBlock[] = [];
  const paragraphLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines.length = 0;
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const nextLine = lines[index + 1];

    if (isPipeTableRow(line) && nextLine && isTableSeparator(nextLine)) {
      flushParagraph();
      const headers = parsePipeCells(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && isPipeTableRow(lines[index])) {
        if (!isTableSeparator(lines[index])) {
          rows.push(parsePipeCells(lines[index]));
        }
        index += 1;
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const bulletText = readBulletText(line);
    if (bulletText) {
      flushParagraph();
      const items: string[] = [];

      while (index < lines.length) {
        const nextBulletText = readBulletText(lines[index]);
        if (!nextBulletText) {
          break;
        }

        const itemParts = [nextBulletText];
        index += 1;

        while (
          index < lines.length &&
          lines[index].trim() &&
          !readBulletText(lines[index]) &&
          !(isPipeTableRow(lines[index]) && lines[index + 1] && isTableSeparator(lines[index + 1])) &&
          !isTableSeparator(lines[index])
        ) {
          itemParts.push(lines[index].trim());
          index += 1;
        }

        items.push(itemParts.join(" "));
      }

      blocks.push({ type: "list", items });
      continue;
    }

    if (isTableSeparator(line)) {
      index += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      <strong key={`${match.index}-${match[1]}`} className="font-black text-foreground">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseAssistantContent(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 text-base leading-7 text-foreground">
      {blocks.map((block, blockIndex) => {
        if (block.type === "table") {
          return (
            <div key={`table-${blockIndex}`} className="premium-scrollbar -mx-1 overflow-x-auto pb-1">
              <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[14px] text-left text-sm shadow-inner ring-1 ring-neon-cyan/20">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`${header}-${headerIndex}`}
                        className="border-b border-neon-cyan/20 bg-neon-cyan/10 px-3 py-2 font-black uppercase tracking-wide text-neon-cyan"
                      >
                        {renderInlineMarkdown(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="odd:bg-white/70 even:bg-slate-50/75">
                      {block.headers.map((_, cellIndex) => (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className="border-b border-border/70 px-3 py-2 align-top text-foreground last:border-b-0"
                        >
                          {renderInlineMarkdown(row[cellIndex] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`list-${blockIndex}`} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`} className="flex gap-2 leading-7">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-neon-cyan shadow-glow" />
                  <span className="min-w-0 break-words">{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className="whitespace-pre-line break-words">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
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
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-white">{message.content}</p>
        ) : (
          <AssistantMessageContent content={message.content} />
        )}
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
