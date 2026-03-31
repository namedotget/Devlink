import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect, useRef } from "react";
import {
  getTeamChatMessages,
  sendTeamMessage,
  clearTeamChat,
  getUsers,
  parseSender,
  isTeamChatBootstrapMessage,
} from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import {
  PRIMARY,
  DIM,
  ERROR,
  CHAT_COLORS,
  TEXT_HIGHLIGHT,
  TEXT_PRIMARY,
  TEXT_DIM,
  BORDER_SUBTLE,
} from "../theme.js";
import { useTerminalSize, chatPanelHeight } from "../../lib/terminal-size.js";
import type { User, LinqMessage, CustomRole } from "../../types/index.js";

const POLL_INTERVAL_MS = 5000;
const CHROME_LINES = 14;

interface UserMeta {
  color: string;
  systemRole: string;
  customRoles: CustomRole[];
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return "\u2022".repeat(phone.length);
  const prefix = phone.startsWith("+") ? "+" : "";
  const countryLen = digits.length > 10 ? digits.length - 10 : 1;
  return `${prefix}${digits.slice(0, countryLen)}${"\u2022".repeat(6)}${digits.slice(-4)}`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return CHAT_COLORS[hash % CHAT_COLORS.length]!;
}

interface MessageThreadProps {
  currentUser: User;
  onBack: () => void;
}

interface DisplayMessage {
  id: string;
  sender: string;
  body: string;
  sentAt: string;
  isMe: boolean;
  isSystem: boolean;
}

interface DisplayMessageGroup {
  id: string;
  sender: string;
  isMe: boolean;
  messages: Array<{ body: string; sentAt: string }>;
}

// Returns the line height of one message group excluding the inter-group gap.
// Actual body width: bubbleWidth - 2 (borders) - 2 (paddingX) - 1 (gap) - 8 (timestamp) = bubbleWidth - 13
function estimateGroupLines(group: DisplayMessageGroup, bubbleWidth: number): number {
  const innerWidth = Math.max(12, bubbleWidth - 13);
  const msgLines = group.messages.reduce((sum, m) => {
    return sum + Math.max(1, Math.ceil(m.body.length / innerWidth));
  }, 0);
  return msgLines + 3; // +1 sender header, +2 box border top/bottom
}

interface ViewportResult {
  groupedVisible: DisplayMessageGroup[];
  startGroupIdx: number;
  hasMoreAbove: boolean;
  hasMoreBelow: boolean;
  clampedOffset: number;
}

function computeViewport(
  grouped: DisplayMessageGroup[],
  scrollOffset: number,
  contentLines: number,
  bubbleWidth: number,
): ViewportResult {
  const maxScroll = Math.max(0, grouped.length - 1);
  const clampedOffset = Math.min(scrollOffset, maxScroll);
  const endGroupIdx = Math.max(0, grouped.length - clampedOffset);

  // Reserve 2 lines for scroll indicators (conservative — avoids clip when both show).
  const available = Math.max(4, contentLines - 2);

  let startGroupIdx = endGroupIdx;
  let usedLines = 0;
  while (startGroupIdx > 0) {
    const g = grouped[startGroupIdx - 1]!;
    // +1 for the marginTop gap between groups (not charged on the first/topmost group)
    const cost = estimateGroupLines(g, bubbleWidth) + (usedLines > 0 ? 1 : 0);
    if (usedLines + cost > available) break;
    usedLines += cost;
    startGroupIdx -= 1;
  }

  return {
    groupedVisible: grouped.slice(startGroupIdx, endGroupIdx),
    startGroupIdx,
    hasMoreAbove: startGroupIdx > 0,
    hasMoreBelow: clampedOffset > 0,
    clampedOffset,
  };
}

function resolveMessage(
  msg: LinqMessage,
  phoneToUsername: Map<string, string>,
  currentUserUsername: string,
): DisplayMessage {
  const time = new Date(msg.sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isTeamChatBootstrapMessage(msg.text)) {
    return {
      id: msg.id,
      sender: "",
      body: "",
      sentAt: time,
      isMe: false,
      isSystem: true,
    };
  }

  if (msg.isFromMe) {
    const { sender, body, username } = parseSender(msg.text);
    const isSystem = sender === "System";
    return {
      id: msg.id,
      sender: isSystem ? "" : (username ?? sender ?? currentUserUsername),
      body,
      sentAt: time,
      isMe: !isSystem,
      isSystem,
    };
  }

  const handle = msg.fromHandle ?? "";
  const phoneLabel =
    phoneToUsername.get(handle) ?? (handle ? maskPhone(handle) : "Unknown");
  const parsed = parseSender(msg.text);
  if (
    parsed.sender !== null &&
    parsed.sender !== "System" &&
    parsed.username !== null
  ) {
    return {
      id: msg.id,
      sender: parsed.username,
      body: parsed.body,
      sentAt: time,
      isMe: false,
      isSystem: false,
    };
  }
  return {
    id: msg.id,
    sender: phoneLabel,
    body: msg.text,
    sentAt: time,
    isMe: false,
    isSystem: false,
  };
}

export function MessageThread({ currentUser, onBack }: MessageThreadProps) {
  const { rows, columns } = useTerminalSize();
  const listHeight = chatPanelHeight(rows, CHROME_LINES);
  const bubbleWidth = Math.max(20, Math.floor((columns - 6) * 0.65));

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [phoneToUsername, setPhoneToUsername] = useState<Map<string, string>>(
    new Map(),
  );
  const [userMeta, setUserMeta] = useState<Map<string, UserMeta>>(new Map());
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);
  const [clearedAfterId, setClearedAfterId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smoothScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousTotalRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const suppressNextAutoFollowRef = useRef(false);
  const initializedAtTopRef = useRef(false);
  const phoneMapRef = useRef<Map<string, string>>(new Map());
  const senderProfileRef = useRef<User>(currentUser);

  useEffect(() => {
    async function init() {
      try {
        const allUsers = await getUsers();

        const phoneMap = new Map<string, string>();
        const metaMap = new Map<string, UserMeta>();

        for (const u of allUsers) {
          if (u.phone) {
            phoneMap.set(u.phone, u.username);
          }
          metaMap.set(u.username, {
            color: u.chat_color ?? hashColor(u.username),
            systemRole: u.role,
            customRoles: u.custom_roles ?? [],
          });
        }

        setPhoneToUsername(phoneMap);
        setUserMeta(metaMap);
        phoneMapRef.current = phoneMap;

        const enriched = allUsers.find((u) => u.id === currentUser.id);
        senderProfileRef.current = enriched
          ? {
              ...enriched,
              ...currentUser,
              custom_roles:
                currentUser.custom_roles && currentUser.custom_roles.length > 0
                  ? currentUser.custom_roles
                  : (enriched.custom_roles ?? []),
            }
          : currentUser;

        const { chatId: id, messages: raw } = await getTeamChatMessages();
        setChatId(id);

        setMessages(
          raw.map((m) =>
            resolveMessage(m, phoneMapRef.current, currentUser.username),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to open team chat.");
      }
      setInitializing(false);
    }
    init();
  }, [currentUser.id, currentUser.username]);

  useEffect(() => {
    senderProfileRef.current = { ...senderProfileRef.current, ...currentUser };
  }, [currentUser]);

  useEffect(() => {
    if (!chatId) return;
    intervalRef.current = setInterval(async () => {
      setPolling(true);
      try {
        const { messages: raw } = await getTeamChatMessages();
        setMessages(
          raw.map((m) =>
            resolveMessage(m, phoneMapRef.current, currentUser.username),
          ),
        );
      } catch {
        // silent
      }
      setPolling(false);
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [chatId, currentUser.username]);

  const allFiltered = messages.filter((m) => !m.isSystem);
  const filtered = (() => {
    if (!clearedAfterId) return allFiltered;
    const idx = allFiltered.findIndex((m) => m.id === clearedAfterId);
    return idx >= 0 ? allFiltered.slice(idx + 1) : allFiltered;
  })();
  const total = filtered.length;
  const grouped = filtered.reduce<DisplayMessageGroup[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.sender === msg.sender && last.isMe === msg.isMe) {
      last.messages.push({ body: msg.body, sentAt: msg.sentAt });
      return acc;
    }
    acc.push({
      id: msg.id,
      sender: msg.sender,
      isMe: msg.isMe,
      messages: [{ body: msg.body, sentAt: msg.sentAt }],
    });
    return acc;
  }, []);
  const maxScroll = Math.max(0, grouped.length - 1);
  const contentLines = Math.max(4, listHeight - 2);
  const { groupedVisible, startGroupIdx, hasMoreAbove, hasMoreBelow, clampedOffset } =
    computeViewport(grouped, scrollOffset, contentLines, bubbleWidth);

  useEffect(() => {
    if (initializedAtTopRef.current) return;
    if (total <= 0) return;
    initializedAtTopRef.current = true;
    previousTotalRef.current = total;
    // Start at newest messages (offset 0), like Discord
    setScrollOffset(0);
  }, [total]);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  const FOLLOW_THRESHOLD = 3;

  useEffect(() => {
    const previousTotal = previousTotalRef.current;
    previousTotalRef.current = total;
    if (total <= previousTotal) return;
    if (suppressNextAutoFollowRef.current) {
      suppressNextAutoFollowRef.current = false;
      return;
    }

    const offset = scrollOffsetRef.current;
    if (offset <= 0) return;
    // User has scrolled up far enough that they're deliberately reading history — leave them alone
    if (offset > FOLLOW_THRESHOLD) return;

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

  useInput(
    (_input, key) => {
      if (sending || initializing) return;
      if (key.escape) {
        if (intervalRef.current) clearInterval(intervalRef.current);
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
    },
    { isActive: !initializing },
  );

  async function handleSend() {
    if (!chatId || !input.trim() || sending) return;
    const text = input.trim();

    if (text === "/clear") {
      setInput("");
      if (currentUser.role === "manager") {
        setSending(true);
        try {
          await clearTeamChat();
          setClearedAfterId(null);
          const { messages: raw } = await getTeamChatMessages();
          setMessages(
            raw.map((m) =>
              resolveMessage(m, phoneMapRef.current, currentUser.username),
            ),
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to clear chat.");
        } finally {
          setSending(false);
        }
        setScrollOffset(0);
      } else {
        setError("Only managers can clear the chat.");
      }
      return;
    }

    setInput("");
    setSending(true);
    setError("");
    suppressNextAutoFollowRef.current = true;
    if (scrollOffsetRef.current > 0) {
      setScrollOffset((prev) => prev + 1);
    } else {
      setScrollOffset(0);
    }
    try {
      await sendTeamMessage(text);
      const { messages: raw } = await getTeamChatMessages();
      setMessages(
        raw.map((m) =>
          resolveMessage(m, phoneMapRef.current, currentUser.username),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    }
    setSending(false);
  }

  if (initializing) return <Loader label="Connecting to team chat..." />;

  const myMeta = userMeta.get(currentUser.username);
  const myColor =
    currentUser.chat_color ?? myMeta?.color ?? hashColor(currentUser.username);

  return (
    <Box flexDirection="column" padding={1} width={columns}>
      <Box marginBottom={1} justifyContent="center">
        <Text bold color={PRIMARY}>
          Team Chat
        </Text>
        {polling && (
          <Text color={TEXT_DIM} dimColor>
            {" "}
            (syncing)
          </Text>
        )}
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        paddingX={1}
        marginBottom={1}
        height={listHeight}
      >
        {hasMoreAbove && (
          <Box justifyContent="center" marginBottom={1}>
            <Text color={TEXT_DIM} dimColor>
              {"\u2191"} {startGroupIdx} older above
            </Text>
          </Box>
        )}

        {groupedVisible.length === 0 && !hasMoreAbove ? (
          <Text color={TEXT_DIM} dimColor>
            {clearedAfterId
              ? "Chat cleared."
              : "No messages yet. Say something!"}
          </Text>
        ) : (
          groupedVisible.map((msg, i) => {
            const meta = userMeta.get(msg.sender);
            const senderColor = msg.isMe
              ? myColor
              : (meta?.color ?? hashColor(msg.sender));
            const roleLabel = msg.isMe
              ? myMeta?.systemRole
              : meta?.systemRole;

            if (msg.isMe) {
              return (
                <Box
                  key={msg.id}
                  flexDirection="column"
                  marginTop={i > 0 ? 1 : 0}
                  alignItems="flex-end"
                >
                  <Box gap={1} marginBottom={0}>
                    {roleLabel && (
                      <Text color={TEXT_DIM} dimColor>[{roleLabel}]</Text>
                    )}
                    <Text color={senderColor} bold>{msg.sender}</Text>
                  </Box>
                  <Box
                    flexDirection="column"
                    borderStyle="round"
                    borderColor={senderColor}
                    paddingX={1}
                    width={bubbleWidth}
                  >
                    {msg.messages.map((entry, idx) => (
                      <Box key={`${msg.id}-${idx}`} justifyContent="space-between" gap={1}>
                        <Text color={TEXT_DIM} dimColor>{entry.sentAt}</Text>
                        <Box flexGrow={1} justifyContent="flex-end">
                          <Text color={TEXT_HIGHLIGHT} wrap="wrap">{entry.body}</Text>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            }

            return (
              <Box
                key={msg.id}
                flexDirection="column"
                marginTop={i > 0 ? 1 : 0}
                alignItems="flex-start"
              >
                <Box gap={1} marginBottom={0}>
                  <Text color={senderColor} bold>{msg.sender}</Text>
                  {roleLabel && (
                    <Text color={TEXT_DIM} dimColor>[{roleLabel}]</Text>
                  )}
                </Box>
                <Box
                  flexDirection="column"
                  borderStyle="round"
                  borderColor={senderColor}
                  paddingX={1}
                  width={bubbleWidth}
                >
                  {msg.messages.map((entry, idx) => (
                    <Box key={`${msg.id}-${idx}`} gap={1}>
                      <Box flexGrow={1}>
                        <Text color={TEXT_PRIMARY} wrap="wrap">{entry.body}</Text>
                      </Box>
                      <Text color={TEXT_DIM} dimColor>{entry.sentAt}</Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })
        )}

        {hasMoreBelow && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={TEXT_DIM} dimColor>
              {"\u2193"} {clampedOffset} newer below
            </Text>
          </Box>
        )}
      </Box>

      <Box
        borderStyle="round"
        borderColor={sending ? BORDER_SUBTLE : PRIMARY}
        paddingX={1}
      >
        <Text color={DIM}>{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder={sending ? "Sending..." : "Message the team..."}
          focus={!sending && !initializing}
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
          ...(currentUser.role === "manager"
            ? [{ key: "/clear", label: "clear chat" }]
            : []),
          { key: "Esc", label: "back" },
        ]}
      />
    </Box>
  );
}
