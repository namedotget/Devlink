import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect, useRef } from "react";
import { getAllTasks, getTasksByAssignee, getComments, askAI } from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import {
  PRIMARY,
  DIM,
  ERROR,
  TEXT_HIGHLIGHT,
  TEXT_PRIMARY,
  TEXT_DIM,
  BORDER_SUBTLE,
} from "../theme.js";
import { useTerminalSize, chatPanelHeight } from "../../lib/terminal-size.js";
import type { User, Task, Comment, ChatMessage } from "../../types/index.js";

const AI_COLOR = "#87CEEB";
const CHROME_LINES = 14;

interface AIChatProps {
  currentUser: User;
  onBack: () => void;
}

interface AIMessageGroup {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

function estimateRenderedLines(content: string, width: number): number {
  const innerWidth = Math.max(12, width - 4);
  return content.split("\n").reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / innerWidth));
  }, 0);
}

export function AIChat({ currentUser, onBack }: AIChatProps) {
  const { rows, columns } = useTerminalSize();
  const panelHeight = chatPanelHeight(rows, CHROME_LINES);
  const bubbleWidth = Math.max(20, Math.floor((columns - 6) * 0.65));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);
  const smoothScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousTotalRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const suppressNextAutoFollowRef = useRef(false);
  const initializedAtTopRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        let loadedTasks: Task[] = [];
        let loadedComments: Comment[] = [];

        if (currentUser.role === "manager") {
          loadedTasks = await getAllTasks();
          const nested = await Promise.all(
            loadedTasks.slice(0, 10).map((t) => getComments(t.id))
          );
          loadedComments = nested.flat();
        } else {
          loadedTasks = await getTasksByAssignee(currentUser.id);
          const nested = await Promise.all(
            loadedTasks.map((t) => getComments(t.id))
          );
          loadedComments = nested.flat();
        }

        setTasks(loadedTasks);
        setComments(loadedComments);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load context.");
      }
      setContextLoading(false);
    }
    load();
  }, [currentUser.id, currentUser.role]);

  const contentLines = Math.max(4, panelHeight - 2);
  const maxVisible = Math.max(4, Math.floor(contentLines / 2));
  const total = history.length;
  const groupedHistoryAll = history.reduce<AIMessageGroup[]>((acc, msg, index) => {
    const last = acc[acc.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n${msg.content}`;
      return acc;
    }
    acc.push({
      id: `${msg.role}-${index}`,
      role: msg.role,
      content: msg.content,
    });
    return acc;
  }, []);
  const maxScroll = Math.max(0, groupedHistoryAll.length - 1);
  const clampedOffset = Math.min(scrollOffset, maxScroll);
  const endGroupIdx = Math.max(0, groupedHistoryAll.length - clampedOffset);
  let startGroupIdx = endGroupIdx;
  let usedLines = 0;
  while (startGroupIdx > 0) {
    const g = groupedHistoryAll[startGroupIdx - 1]!;
    const estimate = estimateRenderedLines(g.content, bubbleWidth) + 2;
    if (usedLines + estimate > contentLines && usedLines > 0) break;
    usedLines += estimate;
    startGroupIdx -= 1;
  }
  const groupedHistory = groupedHistoryAll.slice(startGroupIdx, endGroupIdx);
  const hasMoreAbove = startGroupIdx > 0;
  const hasMoreBelow = clampedOffset > 0;

  useEffect(() => {
    if (initializedAtTopRef.current) return;
    if (total <= 0) return;
    initializedAtTopRef.current = true;
    previousTotalRef.current = total;
    setScrollOffset(maxScroll);
  }, [total, maxScroll]);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  useEffect(() => {
    const previousTotal = previousTotalRef.current;
    previousTotalRef.current = total;
    if (total <= previousTotal) return;
    if (suppressNextAutoFollowRef.current) {
      suppressNextAutoFollowRef.current = false;
      return;
    }
    if (scrollOffsetRef.current <= 0) return;

    if (smoothScrollRef.current) clearInterval(smoothScrollRef.current);
    smoothScrollRef.current = setInterval(() => {
      setScrollOffset((prev) => {
        if (prev <= 0) {
          if (smoothScrollRef.current) clearInterval(smoothScrollRef.current);
          smoothScrollRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 40);
  }, [total]);

  useEffect(() => {
    return () => {
      if (smoothScrollRef.current) clearInterval(smoothScrollRef.current);
    };
  }, []);

  useInput((input_char, key) => {
    if (contextLoading || thinking) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setScrollOffset((prev) => Math.min(prev + 1, maxScroll));
      return;
    }
    if (key.downArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
      return;
    }
  });

  async function handleSend() {
    if (!input.trim() || thinking || contextLoading) return;
    const userMessage = input.trim();

    if (userMessage === "/clear") {
      setInput("");
      setHistory([]);
      setScrollOffset(0);
      setError("");
      return;
    }

    setInput("");
    suppressNextAutoFollowRef.current = true;
    if (scrollOffsetRef.current > 0) {
      setScrollOffset((prev) => prev + 1);
    } else {
      setScrollOffset(0);
    }

    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage },
    ];
    setHistory(nextHistory);
    setThinking(true);
    setError("");

    try {
      const response = await askAI(nextHistory, currentUser, tasks, comments);
      suppressNextAutoFollowRef.current = true;
      if (scrollOffsetRef.current > 0) {
        setScrollOffset((prev) => prev + 1);
      }
      setHistory([...nextHistory, { role: "assistant", content: response }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get AI response.");
    }
    setThinking(false);
  }

  if (contextLoading) return <Loader label="Loading task context..." />;

  return (
    <Box flexDirection="column" padding={1} width={columns}>
      <Box marginBottom={1} justifyContent="center">
        <Text bold color={PRIMARY}>AI Assistant</Text>
        <Text color={TEXT_DIM} dimColor>{" "}({tasks.length} tasks loaded)</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        paddingX={1}
        marginBottom={1}
        height={panelHeight}
      >
        {hasMoreAbove && (
          <Box justifyContent="center" marginBottom={1}>
            <Text color={TEXT_DIM} dimColor>{"\u2191"} {startGroupIdx} older above</Text>
          </Box>
        )}

        {groupedHistory.length === 0 && !hasMoreAbove ? (
          <Text color={TEXT_DIM} dimColor>
            Ask anything about your tasks, priorities, or blockers.
          </Text>
        ) : (
          groupedHistory.map((msg, i) => {
            const isUser = msg.role === "user";

            if (isUser) {
              return (
                <Box key={msg.id} flexDirection="column" marginTop={i > 0 ? 1 : 0} paddingRight={1}>
                  <Box justifyContent="flex-end">
                    <Text color={TEXT_HIGHLIGHT} wrap="wrap">{msg.content}</Text>
                  </Box>
                </Box>
              );
            }

            return (
              <Box key={msg.id} flexDirection="column" marginTop={i > 0 ? 1 : 0} paddingLeft={1}>
                <Text color={AI_COLOR} bold>AI</Text>
                <Box paddingLeft={1}>
                  <Text color={TEXT_PRIMARY} wrap="wrap">{msg.content}</Text>
                </Box>
              </Box>
            );
          })
        )}

        {thinking && (
          <Box marginTop={1}>
            <Text color={AI_COLOR} bold>AI </Text>
            <Text color={TEXT_DIM}>Thinking...</Text>
          </Box>
        )}

        {hasMoreBelow && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={TEXT_DIM} dimColor>{"\u2193"} {clampedOffset} newer below</Text>
          </Box>
        )}
      </Box>

      <Box borderStyle="round" borderColor={thinking ? BORDER_SUBTLE : PRIMARY} paddingX={1}>
        <Text color={DIM}>{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder={thinking ? "Waiting for response..." : "Ask about your tasks..."}
          focus={!thinking && !contextLoading}
        />
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color={ERROR}>{error}</Text>
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "Enter", label: "send" },
          { key: "\u2191\u2193", label: "scroll" },
          { key: "/clear", label: "reset" },
          { key: "Esc", label: "back" },
        ]}
      />
    </Box>
  );
}
