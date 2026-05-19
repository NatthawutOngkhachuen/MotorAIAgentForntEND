import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDown, Clock, LogIn, MessageSquareText, Plus, Send, Trash2 } from "lucide-react";
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/services/apiClient";
import { chatService, type ChatSession, type NormalizedChatMessage, type RecommendationMode } from "@/services/chatService";
import { getStoredAccessToken, getStoredAuthIdentity } from "@/services/authStorage";

function getSessionLabel(session: ChatSession) {
  return session.title?.trim() || session.preview?.trim() || "New Chat";
}

function formatSessionTime(session: ChatSession) {
  const rawDate = session.updatedAt ?? session.createdAt;
  if (!rawDate) {
    return "";
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSessionTime(session: ChatSession) {
  const rawDate = session.updatedAt ?? session.createdAt;
  if (!rawDate) {
    return 0;
  }

  const time = new Date(rawDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function pickLatestSession(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a))[0];
}

const NEAR_BOTTOM_THRESHOLD = 120;

function isNearBottom(container: HTMLDivElement | null) {
  if (!container) {
    return true;
  }

  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
}

export function ChatPage() {
  const [message, setMessage] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>("user-based");
  const [transientMessages, setTransientMessages] = useState<NormalizedChatMessage[]>([]);
  const [transientSince, setTransientSince] = useState<number | null>(null);
  const [streamHasToken, setStreamHasToken] = useState(false);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const lastHistoryScrollSessionRef = useRef<string | undefined>(undefined);
  const accessToken = getStoredAccessToken();
  const hasToken = Boolean(accessToken);
  const currentUserIdentity = getStoredAuthIdentity();
  const sessionsQueryKey = useMemo(() => ["chat-sessions", currentUserIdentity] as const, [currentUserIdentity]);
  const sessionsQuery = useApiQuery({
    queryKey: sessionsQueryKey,
    queryFn: chatService.getChatSessions,
    enabled: hasToken,
  });
  const historyQuery = useApiQuery({
    queryKey: ["chat-history", currentUserIdentity, activeSessionId],
    queryFn: () => chatService.getChatHistory(activeSessionId!),
    enabled: hasToken && Boolean(activeSessionId),
  });
  const startMutation = useMutation({
    mutationFn: () =>
      chatService.startRecommendationChat(recommendationMode, {
        onSession: (sessionId) => setActiveSessionId(sessionId),
        onToken: (token) => {
          setStreamHasToken(true);
          setTransientMessages((current) => {
            const assistantIndex = current.findIndex((item) => item.id === "local-assistant-start-stream");
            if (assistantIndex === -1) {
              return [
                ...current,
                {
                  id: "local-assistant-start-stream",
                  role: "assistant",
                  content: token,
                },
              ];
            }

            return current.map((item, index) => (index === assistantIndex ? { ...item, content: `${item.content}${token}` } : item));
          });
        },
      }),
    onMutate: () => {
      setTransientSince(Date.now());
      setTransientMessages([]);
      setStreamHasToken(false);
    },
    onSuccess: async (sessionId) => {
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      if (sessionId) {
        queryClient.removeQueries({ queryKey: ["chat-history", currentUserIdentity, sessionId] });
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  });
  const sendMutation = useMutation({
    mutationFn: async (nextMessage: string) => {
      let sessionId = activeSessionId;

      if (!sessionId) {
        sessionId = await chatService.startRecommendationChat(recommendationMode, {
          onSession: (nextSessionId) => {
            sessionId = nextSessionId;
            setActiveSessionId(nextSessionId);
          },
        });
      }

      if (!sessionId) {
        throw new Error("Recommendation session was not created by the streaming API.");
      }

      await chatService.streamRecommendationChatMessage(recommendationMode, nextMessage, sessionId, {
        onSession: (nextSessionId) => {
          sessionId = nextSessionId;
          setActiveSessionId(nextSessionId);
        },
        onToken: (token) => {
          setStreamHasToken(true);
          setTransientMessages((current) => {
            const assistantIndex = current.findIndex((item) => item.id === "local-assistant-stream");
            if (assistantIndex === -1) {
              return [
                ...current,
                {
                  id: "local-assistant-stream",
                  role: "assistant",
                  content: token,
                },
              ];
            }

            return current.map((item, index) => (index === assistantIndex ? { ...item, content: `${item.content}${token}` } : item));
          });
        },
      });

      return { sessionId };
    },
    onMutate: (nextMessage) => {
      const now = Date.now();
      setTransientSince(now);
      setStreamHasToken(false);
      setMessage("");
      setTransientMessages([
        {
          id: `local-user-${now}`,
          role: "user",
          content: nextMessage,
        },
      ]);
    },
    onSuccess: async (response) => {
      setActiveSessionId(response.sessionId);
      const sessions = await queryClient.fetchQuery({
        queryKey: sessionsQueryKey,
        queryFn: chatService.getChatSessions,
      });
      if (!response.sessionId && !activeSessionId) {
        const latestSession = pickLatestSession(sessions);
        if (latestSession?.id) {
          setActiveSessionId(latestSession.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["chat-history", currentUserIdentity] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => chatService.deleteChatSession(sessionId),
    onSuccess: async (_response, sessionId) => {
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      queryClient.removeQueries({ queryKey: ["chat-history", currentUserIdentity, sessionId] });
      if (sessionId === activeSessionId) {
        setActiveSessionId(undefined);
        setTransientMessages([]);
        setTransientSince(null);
        setStreamHasToken(false);
      }
    },
  });
  const messages = historyQuery.data ?? [];
  const displayedMessages = useMemo(() => [...messages, ...transientMessages], [messages, transientMessages]);
  const messageScrollKey = useMemo(
    () => displayedMessages.map((item) => `${item.id}:${item.content.length}`).join("|"),
    [displayedMessages],
  );
  const activeSession = sessionsQuery.data?.find((session) => session.id === activeSessionId);
  const chatTitle = activeSession ? getSessionLabel(activeSession) : "New Chat";
  const loginRequired =
    !hasToken || isUnauthorizedError(sessionsQuery.error) || isUnauthorizedError(historyQuery.error) || isUnauthorizedError(sendMutation.error);

  useEffect(() => {
    setActiveSessionId(undefined);
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
  }, [currentUserIdentity, hasToken]);

  useEffect(() => {
    if (activeSessionId && sessionsQuery.data && !sessionsQuery.data.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessionsQuery.data[0]?.id);
    }
  }, [activeSessionId, sessionsQuery.data]);

  useEffect(() => {
    if (transientSince && historyQuery.dataUpdatedAt > transientSince && !historyQuery.isFetching && !sendMutation.isPending && !startMutation.isPending) {
      setTransientMessages([]);
      setTransientSince(null);
      setStreamHasToken(false);
    }
  }, [historyQuery.dataUpdatedAt, historyQuery.isFetching, sendMutation.isPending, startMutation.isPending, transientSince]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
      shouldAutoScrollRef.current = true;
      setShowScrollToLatest(false);
      scrollFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setShowScrollToLatest(false);
    scrollToBottom("auto");
  }, [activeSessionId, scrollToBottom]);

  useEffect(() => {
    const shouldInstantScrollHistory =
      Boolean(activeSessionId) &&
      !historyQuery.isFetching &&
      lastHistoryScrollSessionRef.current !== activeSessionId &&
      (historyQuery.dataUpdatedAt > 0 || displayedMessages.length === 0);

    if (shouldInstantScrollHistory) {
      lastHistoryScrollSessionRef.current = activeSessionId;
      shouldAutoScrollRef.current = true;
      scrollToBottom("auto");
      return;
    }

    if (shouldAutoScrollRef.current || isNearBottom(messagesContainerRef.current)) {
      scrollToBottom("smooth");
      return;
    }

    if (displayedMessages.length > 0 || sendMutation.isPending || startMutation.isPending) {
      setShowScrollToLatest(true);
    }
  }, [
    activeSessionId,
    displayedMessages.length,
    historyQuery.dataUpdatedAt,
    historyQuery.isFetching,
    messageScrollKey,
    scrollToBottom,
    sendMutation.isPending,
    startMutation.isPending,
    streamHasToken,
  ]);

  function handleMessagesScroll() {
    const nearBottom = isNearBottom(messagesContainerRef.current);
    shouldAutoScrollRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollToLatest(false);
    }
  }

  function startNewChat() {
    setActiveSessionId(undefined);
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
    sendMutation.reset();
    startMutation.reset();
    setMessage("");
    if (hasToken) {
      startMutation.mutate();
    }
  }

  function selectSession(sessionId: string) {
    if (sessionId === activeSessionId) {
      return;
    }
    setActiveSessionId(sessionId);
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
    sendMutation.reset();
    startMutation.reset();
  }

  function selectRecommendationMode(mode: RecommendationMode) {
    if (mode === recommendationMode || sendMutation.isPending || startMutation.isPending) {
      return;
    }

    setRecommendationMode(mode);
    setActiveSessionId(undefined);
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
    sendMutation.reset();
    startMutation.reset();
    setMessage("");
  }

  function deleteSession(event: MouseEvent<HTMLButtonElement>, sessionId: string) {
    event.stopPropagation();
    if (window.confirm("Delete this chat session?")) {
      deleteMutation.mutate(sessionId);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasToken && message.trim() && !startMutation.isPending) {
      shouldAutoScrollRef.current = true;
      setShowScrollToLatest(false);
      sendMutation.mutate(message.trim());
    }
  }

  if (loginRequired) {
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100vh-3rem)] flex-col">
        <PageHeader
          eyebrow="Assistant"
          title="Chat"
          description="Sign in to access your private MotoAI chat sessions."
        />
        <Card>
          <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-6 text-center">
            <EmptyState
              icon={LogIn}
              title="Login required"
              description={hasToken ? "Login required. Please sign in again." : "Please sign in before opening your chat history."}
            />
            <Button asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                Go to login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[calc(100vh-3rem)] flex-col lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
      <PageHeader
        eyebrow="AI Control"
        title="Chat"
        description="Ask the sales assistant questions backed by the recommendation API."
      />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="carbon-panel moto-cut-card relative flex max-h-[calc(100vh-11rem)] min-h-[18rem] flex-col p-4 lg:max-h-none lg:min-h-0">
          <div className="ai-light-sheen opacity-35" />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">Chat History</p>
              <p className="mt-1 text-xs text-muted-foreground">Your saved sessions</p>
            </div>
            <Button type="button" onClick={startNewChat} className="shrink-0 shadow-glow">
              <Plus className="h-4 w-4" />
              {startMutation.isPending ? "Starting..." : "New Chat"}
            </Button>
          </div>

          <div className="premium-scrollbar relative min-h-0 flex-1 overflow-y-auto pr-1">
            {sessionsQuery.isLoading ? <LoadingState /> : null}
            {sessionsQuery.isError ? <ErrorState message={sessionsQuery.error.message} onRetry={() => sessionsQuery.refetch()} /> : null}
            {!sessionsQuery.isLoading && !sessionsQuery.isError && sessionsQuery.data?.length === 0 ? (
              <div className="rounded-[14px] bg-carbon-950/50 p-4 text-center text-sm text-muted-foreground ring-1 ring-white/10">
                No chat history yet
              </div>
            ) : null}
            <div className="space-y-2">
              {sessionsQuery.data?.map((session) => {
                const isActive = session.id === activeSessionId;
                const title = getSessionLabel(session);
                const time = formatSessionTime(session);

                return (
                  <motion.div
                    key={session.id}
                    whileHover={{ x: 3 }}
                    transition={{ duration: 0.18 }}
                    className={cn(
                      "group relative flex w-full items-start gap-2 rounded-[14px] p-3 text-left transition duration-200",
                      "bg-carbon-950/38 hover:bg-graphite-800/55",
                      isActive && "bg-gradient-to-r from-blue-700/18 via-neon-cyan/10 to-transparent shadow-glow ring-1 ring-neon-cyan/25",
                    )}
                  >
                    {isActive ? <span className="absolute bottom-2 left-0 top-2 w-1 bg-gradient-to-b from-neon-cyan to-blue-600 shadow-glow" /> : null}
                    <button type="button" onClick={() => selectSession(session.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                      <MessageSquareText className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-neon-cyan" : "text-neon-steel")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{title}</p>
                        {session.preview && session.preview !== title ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{session.preview}</p>
                        ) : null}
                        {time ? (
                          <p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {time}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${title}`}
                      onClick={(event) => deleteSession(event, session.id)}
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent text-muted-foreground opacity-0 transition",
                        "hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100",
                        deleteMutation.isPending && "pointer-events-none opacity-50",
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-h-[34rem] min-w-0 flex-col gap-4 lg:min-h-0">
          <Card className="cockpit-surface gradient-border min-h-0 flex-1">
            <div className="ai-light-sheen opacity-35" />
            <CardContent className="flex h-full min-h-[28rem] flex-col p-0">
              <div className="relative flex items-center justify-between gap-3 px-5 py-4">
                <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-neon-cyan/45 via-white/10 to-transparent" />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">MotoAI Assistant</p>
                  <h2 className="mt-1 truncate text-xl font-black uppercase tracking-wide text-foreground">{chatTitle}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="grid grid-cols-2 rounded-md bg-carbon-950/55 p-1 ring-1 ring-white/10">
                    {[
                      { label: "User", value: "user-based" },
                      { label: "Cluster", value: "cluster-based" },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        disabled={sendMutation.isPending || startMutation.isPending}
                        onClick={() => selectRecommendationMode(mode.value as RecommendationMode)}
                        className={cn(
                          "rounded px-3 py-1.5 text-xs font-black uppercase tracking-wide transition disabled:pointer-events-none disabled:opacity-50",
                          recommendationMode === mode.value
                            ? "bg-neon-cyan text-carbon-950 shadow-glow"
                            : "text-muted-foreground hover:bg-graphite-800/80 hover:text-foreground",
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <Button type="button" size="icon" variant="outline" aria-label="Start new chat" onClick={startNewChat} disabled={startMutation.isPending || sendMutation.isPending} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className="pointer-events-none absolute inset-0 ai-grid-glow opacity-35" />
                <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="premium-scrollbar relative h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 py-5 pb-20">
                  <div className="flex min-h-full flex-col gap-4">
                    {historyQuery.isLoading ? <LoadingState /> : null}
                    {historyQuery.isError ? <ErrorState message={historyQuery.error.message} onRetry={() => historyQuery.refetch()} /> : null}
                    {!historyQuery.isLoading && !historyQuery.isError && displayedMessages.length === 0 ? (
                      <div className="mx-auto flex min-h-[18rem] max-w-xl flex-col items-center justify-center text-center">
                        <div className="mb-4 grid h-14 w-14 place-items-center rounded-[16px] bg-gradient-to-br from-blue-700/22 to-neon-cyan/10 shadow-glow ring-1 ring-neon-cyan/25">
                          <MessageSquareText className="h-6 w-6 text-neon-cyan" />
                        </div>
                        <p className="moto-heading text-lg">{activeSessionId ? "Empty Session" : "MotoAI Ready"}</p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {activeSessionId ? "This session has no messages returned by the history API." : "Start an AI-guided recommendation chat or select a saved session."}
                        </p>
                      </div>
                    ) : null}
                    {displayedMessages.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.12) }}
                      >
                        <ChatMessage message={item} />
                      </motion.div>
                    ))}
                    {sendMutation.isPending && !streamHasToken ? <TypingIndicator /> : null}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                {showScrollToLatest ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => scrollToBottom("smooth")}
                    className="absolute bottom-4 right-5 z-10 border border-neon-cyan/45 bg-gradient-to-r from-blue-700 to-neon-cyan text-white shadow-glow"
                  >
                    <ArrowDown className="h-4 w-4" />
                    Scroll to latest
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          {startMutation.isError ? <ErrorState message={startMutation.error.message} /> : null}
          {sendMutation.isError ? <ErrorState message={sendMutation.error.message} /> : null}
          {deleteMutation.isError ? <ErrorState message={deleteMutation.error.message} /> : null}
          <form onSubmit={onSubmit} className="cockpit-surface gradient-border shrink-0 rounded-[18px] p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a sales or recommendation query..."
                className="min-h-20 flex-1 resize-none border-0 bg-carbon-950/55 shadow-inner ring-1 ring-white/10 focus:ring-neon-cyan/35"
              />
              <Button type="submit" size="lg" disabled={sendMutation.isPending || startMutation.isPending || !message.trim()} className="sm:self-end">
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  );
}
