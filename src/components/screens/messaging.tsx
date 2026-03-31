import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { StatusBar } from "../ui/status-bar.js";
import { BORDER_SUBTLE, FOCUS, PRIMARY, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import type { User } from "../../types/index.js";

interface MessagingProps {
  currentUser: User;
  onOpenTeamChat: () => void;
  onOpenAI: () => void;
  onBack: () => void;
}

type Entry = "team" | "ai";
const ENTRIES: Entry[] = ["team", "ai"];

const LABELS: Record<Entry, { title: string; subtitle: string }> = {
  team: { title: "Team Chat", subtitle: "iMessage group with all teammates" },
  ai: { title: "AI Assistant", subtitle: "Groq + Linq bridge to your phone" },
};

export function Messaging({ currentUser: _currentUser, onOpenTeamChat, onOpenAI, onBack }: MessagingProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "b") {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(ENTRIES.length - 1, c + 1));
      return;
    }
    if (key.return) {
      const entry = ENTRIES[cursor];
      if (entry === "team") onOpenTeamChat();
      else onOpenAI();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={FOCUS}>Messaging</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        padding={1}
        marginBottom={1}
      >
        {ENTRIES.map((entry, i) => {
          const isSelected = i === cursor;
          const { title, subtitle } = LABELS[entry];
          return (
            <Box key={entry} flexDirection="column" marginBottom={i < ENTRIES.length - 1 ? 1 : 0}>
              <Box gap={2}>
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>
                  {isSelected ? "▶" : " "}
                </Text>
                <Text color={isSelected ? PRIMARY : TEXT_MUTED} bold={isSelected}>
                  {title}
                </Text>
              </Box>
              <Box paddingLeft={3}>
                <Text color={TEXT_DIM} dimColor>{subtitle}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <StatusBar
        bindings={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "b/Esc", label: "back" },
        ]}
      />
    </Box>
  );
}
