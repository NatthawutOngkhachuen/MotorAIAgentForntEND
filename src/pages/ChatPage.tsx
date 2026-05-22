import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDown, Clock, History, LogIn, LogOut, MessageSquareText, Plus, Send, Trash2, X } from "lucide-react";
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
import { clearAuthStorage, getStoredAccessToken, getStoredAuthIdentity } from "@/services/authStorage";

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

const NEAR_BOTTOM_THRESHOLD = 120;
const WELCOME_MESSAGE_ID = "local-assistant-welcome";
const DEFAULT_RECOMMENDATION_MODE: RecommendationMode = "graph-rag";
const MODE_WELCOME_MESSAGES: Record<RecommendationMode, string> = {
  "graph-rag": "สวัสดีครับ ถามเรื่องรุ่น ยี่ห้อ หรือคุณสมบัติที่สนใจได้เลยครับ เช่น งบประมาณเท่านี้ควรเลือกรุ่นไหน หรือรุ่นไหนเหมาะกับการใช้งานของคุณ",
  "user-based": "สวัสดีครับ บอกงบประมาณ การใช้งาน สไตล์ที่ชอบ หรือรุ่นที่สนใจมาได้เลยครับ ผมจะช่วยแนะนำตัวเลือกที่เหมาะกับคุณ",
  "cluster-based": "สวัสดีครับ บอกความต้องการหรือรุ่นที่สนใจมาได้เลยครับ ผมจะช่วยจัดกลุ่มตัวเลือกที่ใกล้เคียงและน่าสนใจให้",
};
const RECOMMENDATION_MODES: Array<{ label: string; value: RecommendationMode }> = [
  { label: "User", value: "user-based" },
  { label: "Cluster", value: "cluster-based" },
  { label: "GraphRAG", value: "graph-rag" },
];
const SESSION_MODE_STORAGE_PREFIX = "motoai_chat_session_modes";

function sessionModeStorageKey(identity: string) {
  return `${SESSION_MODE_STORAGE_PREFIX}:${identity}`;
}

function readSessionModeMap(identity: string) {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = localStorage.getItem(sessionModeStorageKey(identity));
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, RecommendationMode] =>
        entry[1] === "user-based" || entry[1] === "cluster-based" || entry[1] === "graph-rag",
      ),
    );
  } catch {
    return {};
  }
}

function writeSessionModeMap(identity: string, modeMap: Record<string, RecommendationMode>) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(sessionModeStorageKey(identity), JSON.stringify(modeMap));
}

function readSessionMode(session: ChatSession | undefined, modeMap: Record<string, RecommendationMode>) {
  if (!session) {
    return undefined;
  }

  return session.recommendationMode ?? modeMap[session.id];
}

function isNearBottom(container: HTMLDivElement | null) {
  if (!container) {
    return true;
  }

  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
}

function readMessageTime(message: NormalizedChatMessage) {
  if (!message.createdAt) {
    return undefined;
  }

  const time = new Date(message.createdAt).getTime();
  return Number.isNaN(time) ? undefined : time;
}

function withAssistantResponseTimes(messages: NormalizedChatMessage[]) {
  let lastUserTime: number | undefined;

  return messages.map((message) => {
    const messageTime = readMessageTime(message);
    if (message.role === "user") {
      lastUserTime = messageTime;
      return message;
    }

    if (typeof message.responseTimeMs === "number" || lastUserTime === undefined || messageTime === undefined || messageTime < lastUserTime) {
      return message;
    }

    return {
      ...message,
      responseTimeMs: messageTime - lastUserTime,
    };
  });
}

function normalizeChatContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

function historyIncludesMessage(historyMessages: NormalizedChatMessage[], transientMessage: NormalizedChatMessage) {
  const transientContent = normalizeChatContent(transientMessage.content);
  if (!transientContent) {
    return true;
  }

  return historyMessages.some((message) => {
    if (message.role !== transientMessage.role) {
      return false;
    }

    const historyContent = normalizeChatContent(message.content);
    return historyContent === transientContent || historyContent.includes(transientContent);
  });
}

function createWelcomeMessage(mode: RecommendationMode): NormalizedChatMessage {
  return {
    id: WELCOME_MESSAGE_ID,
    role: "assistant",
    content: MODE_WELCOME_MESSAGES[mode],
  };
}

export function ChatPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>(DEFAULT_RECOMMENDATION_MODE);
  const [localWelcomeMessage, setLocalWelcomeMessage] = useState<NormalizedChatMessage | null>(() =>
    createWelcomeMessage(DEFAULT_RECOMMENDATION_MODE),
  );
  const [transientMessages, setTransientMessages] = useState<NormalizedChatMessage[]>([]);
  const [transientSince, setTransientSince] = useState<number | null>(null);
  const [streamHasToken, setStreamHasToken] = useState(false);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const followUpScrollFrameRef = useRef<number | null>(null);
  const lastHistoryScrollSessionRef = useRef<string | undefined>(undefined);
  const accessToken = getStoredAccessToken();
  const hasToken = Boolean(accessToken);
  const currentUserIdentity = getStoredAuthIdentity();
  const [sessionModeById, setSessionModeById] = useState<Record<string, RecommendationMode>>(() =>
    readSessionModeMap(currentUserIdentity),
  );
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
  const rememberSessionMode = useCallback(
    (sessionId: string, mode: RecommendationMode) => {
      setSessionModeById((current) => {
        if (current[sessionId] === mode) {
          return current;
        }

        const next = { ...current, [sessionId]: mode };
        writeSessionModeMap(currentUserIdentity, next);
        return next;
      });
    },
    [currentUserIdentity],
  );
  const startMutation = useMutation({
    mutationFn: () =>
      chatService.startRecommendationChat(recommendationMode, {
        onSession: (sessionId) => {
          rememberSessionMode(sessionId, recommendationMode);
          setActiveSessionId(sessionId);
        },
        onToken: (token) => {
          setStreamHasToken(true);
          setTransientMessages((current) => {
            const assistantIndex = current.findIndex((item) => item.id === "local-assistant-start-stream");
            if (assistantIndex === -1) {
              return [
                ...current.filter((item) => item.id !== WELCOME_MESSAGE_ID),
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
      if (sessionId) {
        rememberSessionMode(sessionId, recommendationMode);
        setActiveSessionId(sessionId);
      }

      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      if (sessionId) {
        queryClient.removeQueries({ queryKey: ["chat-history", currentUserIdentity, sessionId] });
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  });
  const sendMutation = useMutation({
    mutationFn: async (nextMessage: string) => {
      const responseStartedAt = performance.now();
      let sessionId = activeSessionId;

      if (!sessionId && recommendationMode === "user-based") {
        sessionId = await chatService.startRecommendationChat(recommendationMode, {
          onSession: (nextSessionId) => {
            sessionId = nextSessionId;
            rememberSessionMode(nextSessionId, recommendationMode);
            setActiveSessionId(nextSessionId);
          },
        });
      }

      if (!sessionId && recommendationMode === "user-based") {
        throw new Error("Recommendation session was not created by the streaming API.");
      }

      await chatService.streamRecommendationChatMessage(recommendationMode, nextMessage, sessionId, {
        onSession: (nextSessionId) => {
          sessionId = nextSessionId;
          rememberSessionMode(nextSessionId, recommendationMode);
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

      const responseTimeMs = performance.now() - responseStartedAt;
      setTransientMessages((current) =>
        current.map((item) => (item.id === "local-assistant-stream" ? { ...item, responseTimeMs } : item)),
      );

      return { sessionId, responseTimeMs };
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
      if (response.sessionId) {
        rememberSessionMode(response.sessionId, recommendationMode);
        setActiveSessionId(response.sessionId);
      }
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["chat-history", currentUserIdentity] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => chatService.deleteChatSession(sessionId),
    onSuccess: async (_response, sessionId) => {
      setSessionModeById((current) => {
        if (!current[sessionId]) {
          return current;
        }

        const next = { ...current };
        delete next[sessionId];
        writeSessionModeMap(currentUserIdentity, next);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      queryClient.removeQueries({ queryKey: ["chat-history", currentUserIdentity, sessionId] });
      if (sessionId === activeSessionId) {
        setActiveSessionId(undefined);
        setLocalWelcomeMessage(createWelcomeMessage(recommendationMode));
        setTransientMessages([]);
        setTransientSince(null);
        setStreamHasToken(false);
      }
    },
  });
  const resetSendMutationRef = useRef(sendMutation.reset);
  const resetStartMutationRef = useRef(startMutation.reset);

  useEffect(() => {
    resetSendMutationRef.current = sendMutation.reset;
  }, [sendMutation.reset]);

  useEffect(() => {
    resetStartMutationRef.current = startMutation.reset;
  }, [startMutation.reset]);

  const resetChatSurface = useCallback((mode: RecommendationMode) => {
    setActiveSessionId(undefined);
    setLocalWelcomeMessage(createWelcomeMessage(mode));
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
    resetSendMutationRef.current();
    resetStartMutationRef.current();
    setMessage("");
  }, []);
  const messages = useMemo(() => (activeSessionId ? historyQuery.data ?? [] : []), [activeSessionId, historyQuery.data]);
  const historyMessagesForDisplay = useMemo(() => {
    if (!localWelcomeMessage) {
      return messages;
    }

    const firstUserMessageIndex = messages.findIndex((item) => item.role === "user");
    if (firstUserMessageIndex >= 0) {
      return messages.slice(firstUserMessageIndex);
    }

    return [];
  }, [localWelcomeMessage, messages]);
  const liveMessagesForDisplay = useMemo(
    () => transientMessages.filter((transientMessage) => !historyIncludesMessage(messages, transientMessage)),
    [messages, transientMessages],
  );
  const transientMessagesPersisted = useMemo(
    () => transientMessages.length > 0 && liveMessagesForDisplay.length === 0,
    [liveMessagesForDisplay.length, transientMessages.length],
  );
  const displayedMessages = useMemo(() => {
    const visibleMessages = [...historyMessagesForDisplay, ...liveMessagesForDisplay].filter((item) => item.id !== WELCOME_MESSAGE_ID);
    return withAssistantResponseTimes(localWelcomeMessage ? [localWelcomeMessage, ...visibleMessages] : visibleMessages);
  }, [historyMessagesForDisplay, liveMessagesForDisplay, localWelcomeMessage]);
  const messageScrollKey = useMemo(
    () => displayedMessages.map((item) => `${item.id}:${item.content.length}`).join("|"),
    [displayedMessages],
  );
  const activeSession = sessionsQuery.data?.find((session) => session.id === activeSessionId);
  const activeSessionMode = activeSessionId ? readSessionMode(activeSession, sessionModeById) : undefined;
  const chatTitle = activeSession ? getSessionLabel(activeSession) : "New Chat";
  const showHistoryLoading = historyQuery.isLoading && displayedMessages.length === 0;
  const loginRequired =
    !hasToken || isUnauthorizedError(sessionsQuery.error) || isUnauthorizedError(historyQuery.error) || isUnauthorizedError(sendMutation.error);

  useEffect(() => {
    resetChatSurface(DEFAULT_RECOMMENDATION_MODE);
    setRecommendationMode(DEFAULT_RECOMMENDATION_MODE);
  }, [currentUserIdentity, hasToken, resetChatSurface]);

  useEffect(() => {
    setSessionModeById(readSessionModeMap(currentUserIdentity));
  }, [currentUserIdentity]);

  useEffect(() => {
    const sessionModes = sessionsQuery.data
      ?.filter((session) => session.recommendationMode)
      .reduce<Record<string, RecommendationMode>>((modes, session) => {
        modes[session.id] = session.recommendationMode!;
        return modes;
      }, {});

    if (!sessionModes || Object.keys(sessionModes).length === 0) {
      return;
    }

    setSessionModeById((current) => {
      const next = { ...current, ...sessionModes };
      writeSessionModeMap(currentUserIdentity, next);
      return next;
    });
  }, [currentUserIdentity, sessionsQuery.data]);

  useEffect(() => {
    if (!activeSessionId || !activeSessionMode || sendMutation.isPending || startMutation.isPending) {
      return;
    }

    if (recommendationMode !== activeSessionMode) {
      setRecommendationMode(activeSessionMode);
    }
  }, [activeSessionId, activeSessionMode, recommendationMode, sendMutation.isPending, startMutation.isPending]);

  useEffect(() => {
    if (
      transientSince &&
      transientMessagesPersisted &&
      historyQuery.dataUpdatedAt > transientSince &&
      !historyQuery.isFetching &&
      !sendMutation.isPending &&
      !startMutation.isPending
    ) {
      setTransientMessages([]);
      setTransientSince(null);
      setStreamHasToken(false);
    }
  }, [historyQuery.dataUpdatedAt, historyQuery.isFetching, sendMutation.isPending, startMutation.isPending, transientMessagesPersisted, transientSince]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    const scrollContainerToBottom = (nextBehavior: ScrollBehavior) => {
      const container = messagesContainerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: nextBehavior,
      });
    };

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollContainerToBottom(behavior);
      if (followUpScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(followUpScrollFrameRef.current);
      }
      followUpScrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollContainerToBottom("auto");
        followUpScrollFrameRef.current = null;
      });
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
      if (followUpScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(followUpScrollFrameRef.current);
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
      !sendMutation.isPending &&
      !startMutation.isPending &&
      !historyQuery.isFetching &&
      lastHistoryScrollSessionRef.current !== activeSessionId &&
      (historyQuery.dataUpdatedAt > 0 || displayedMessages.length === 0);

    if (shouldInstantScrollHistory) {
      lastHistoryScrollSessionRef.current = activeSessionId;
      if (shouldAutoScrollRef.current || isNearBottom(messagesContainerRef.current)) {
        shouldAutoScrollRef.current = true;
        scrollToBottom("auto");
      }
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

  function signOut() {
    clearAuthStorage();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  function startNewChat() {
    setIsHistoryOpen(false);
    setRecommendationMode(DEFAULT_RECOMMENDATION_MODE);
    resetChatSurface(DEFAULT_RECOMMENDATION_MODE);
  }

  function selectSession(sessionId: string) {
    if (sessionId === activeSessionId) {
      return;
    }
    const selectedSession = sessionsQuery.data?.find((session) => session.id === sessionId);
    const selectedSessionMode = readSessionMode(selectedSession, sessionModeById);
    if (selectedSessionMode) {
      setRecommendationMode(selectedSessionMode);
    }
    setActiveSessionId(sessionId);
    setLocalWelcomeMessage(null);
    setTransientMessages([]);
    setTransientSince(null);
    setStreamHasToken(false);
    setShowScrollToLatest(false);
    shouldAutoScrollRef.current = true;
    lastHistoryScrollSessionRef.current = undefined;
    sendMutation.reset();
    startMutation.reset();
    setIsHistoryOpen(false);
  }

  function selectRecommendationMode(mode: RecommendationMode) {
    if (mode === recommendationMode || sendMutation.isPending || startMutation.isPending) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    setRecommendationMode(mode);
    resetChatSurface(mode);
  }

  function deleteSession(event: MouseEvent<HTMLButtonElement>, sessionId: string) {
    event.stopPropagation();
    if (window.confirm("Delete this chat session?")) {
      deleteMutation.mutate(sessionId);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasToken && message.trim() && !sendMutation.isPending && !startMutation.isPending) {
      shouldAutoScrollRef.current = true;
      setShowScrollToLatest(false);
      sendMutation.mutate(message.trim());
    }
  }

  function renderHistoryPanel(showClose = false) {
    return (
      <>
        <div className="ai-light-sheen opacity-35" />
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-cyan">Chat History</p>
            <p className="mt-1 text-sm text-muted-foreground">Your saved sessions</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" onClick={startNewChat} className="shrink-0 shadow-glow">
              <Plus className="h-4 w-4" />
              {startMutation.isPending ? "Starting..." : "New Chat"}
            </Button>
            {showClose ? (
              <Button type="button" variant="outline" size="icon" aria-label="Close chat history" onClick={() => setIsHistoryOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
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
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent text-muted-foreground transition",
                      "hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100",
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
      </>
    );
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
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background lg:h-[calc(100vh-3rem)]">
      <div className="hidden lg:block">
        <PageHeader
          title="Chat"
        />
      </div>
      {isHistoryOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close chat history overlay"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setIsHistoryOpen(false)}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.2 }}
            className="carbon-panel absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col rounded-none p-4 shadow-blue"
          >
            {renderHistoryPanel(true)}
          </motion.aside>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-0 lg:gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="carbon-panel moto-cut-card relative hidden max-h-[calc(100vh-11rem)] min-h-[18rem] flex-col p-4 lg:flex lg:max-h-none lg:min-h-0">
          {renderHistoryPanel()}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:gap-4">
          <Card className="cockpit-surface gradient-border min-h-0 flex-1 max-lg:rounded-none max-lg:border-0 max-lg:shadow-none max-lg:[clip-path:none]">
            <div className="ai-light-sheen opacity-35" />
            <CardContent className="flex h-full min-h-0 flex-col p-0 lg:min-h-[28rem]">
              <div className="relative flex flex-col gap-3 border-b border-neon-cyan/20 px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:border-b-0 lg:px-5 lg:py-4">
                <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-neon-cyan/45 via-white/10 to-transparent" />
                <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto">
                  <Button type="button" variant="outline" size="icon" aria-label="Open chat history" onClick={() => setIsHistoryOpen(true)} className="h-9 w-9 shrink-0 lg:hidden">
                    <History className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-neon-cyan sm:text-sm sm:tracking-[0.18em]">MotoAI Assistant</p>
                    <h2 className="mt-0.5 truncate text-lg font-black uppercase tracking-wide text-foreground sm:text-xl lg:mt-1 lg:text-2xl">{chatTitle}</h2>
                  </div>
                  <Button type="button" variant="outline" size="icon" aria-label="Sign out" onClick={signOut} className="ml-auto h-9 w-9 shrink-0 lg:hidden">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
                  <div className="grid min-w-0 flex-1 grid-cols-3 rounded-md bg-carbon-950/55 p-1 ring-1 ring-white/10 lg:flex-none">
                    {RECOMMENDATION_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        disabled={sendMutation.isPending || startMutation.isPending}
                        onClick={() => selectRecommendationMode(mode.value as RecommendationMode)}
                        className={cn(
                          "rounded px-2 py-1.5 text-[0.66rem] font-black uppercase tracking-wide transition disabled:pointer-events-none disabled:opacity-50 sm:text-xs lg:px-3",
                          recommendationMode === mode.value
                            ? "bg-neon-cyan text-carbon-950 shadow-glow"
                            : "text-muted-foreground hover:bg-graphite-800/80 hover:text-foreground",
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <Button type="button" size="icon" variant="outline" aria-label="Start new chat" onClick={startNewChat} disabled={startMutation.isPending || sendMutation.isPending} className="h-9 w-9 shrink-0 lg:h-10 lg:w-10">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className="pointer-events-none absolute inset-0 ai-grid-glow opacity-35" />
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="premium-scrollbar relative h-full min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 pb-5 sm:px-4 lg:px-5 lg:py-5 lg:pb-20"
                  style={{ overflowAnchor: "none" }}
                >
                  <div className="flex min-h-full flex-col gap-4">
                    {showHistoryLoading ? <LoadingState /> : null}
                    {historyQuery.isError ? <ErrorState message={historyQuery.error.message} onRetry={() => historyQuery.refetch()} /> : null}
                    {!showHistoryLoading && !historyQuery.isError && displayedMessages.length === 0 ? (
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
                    {displayedMessages.map((item, index) => {
                      const isStreamingMessage =
                        !transientMessagesPersisted &&
                        (sendMutation.isPending || startMutation.isPending) &&
                        (item.id === "local-assistant-stream" || item.id === "local-assistant-start-stream");

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.12) }}
                        >
                          <ChatMessage message={item} isStreaming={isStreamingMessage} />
                        </motion.div>
                      );
                    })}
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
          <form onSubmit={onSubmit} className="cockpit-surface gradient-border shrink-0 rounded-none border-x-0 border-b-0 p-2 shadow-showroom lg:rounded-[18px] lg:border lg:p-3">
            <div className="flex items-end gap-2 sm:gap-3">
              <Textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Type a sales or recommendation query..."
                className="min-h-11 max-h-28 flex-1 resize-none border-0 bg-carbon-950/55 text-sm leading-6 shadow-inner ring-1 ring-white/10 focus:ring-neon-cyan/35 sm:text-base sm:leading-7 lg:min-h-20"
              />
              <Button type="submit" size="lg" disabled={sendMutation.isPending || startMutation.isPending || !message.trim()} className="h-11 shrink-0 px-3 sm:h-12 sm:px-6">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{sendMutation.isPending ? "Sending..." : "Send"}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  );
}
