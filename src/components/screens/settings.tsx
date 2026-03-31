import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";
import { deleteUser, updateUserPhone, updateUserChatColor } from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import { BORDER_SUBTLE, CHAT_COLORS, DIM, ERROR, FOCUS, PRIMARY, ROLE_COLORS, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import type { User } from "../../types/index.js";

interface SettingsProps {
  currentUser: User;
  onLogout: () => void;
  onBack: () => void;
  onUserUpdated: (user: User) => void;
}

type Option = "color" | "phone" | "logout" | "delete";
const OPTIONS: Option[] = ["color", "phone", "logout", "delete"];

const COLS = 4;

export function Settings({ currentUser, onLogout, onBack, onUserUpdated }: SettingsProps) {
  const [cursor, setCursor] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentUser.phone ?? "");
  const [colorCursor, setColorCursor] = useState(() => {
    const idx = CHAT_COLORS.indexOf(currentUser.chat_color ?? "");
    return idx >= 0 ? idx : 0;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentOption = OPTIONS[cursor]!;

  useInput(async (input, key) => {
    if (loading) return;

    if (pickingColor) {
      if (key.escape) {
        setPickingColor(false);
        setError("");
        return;
      }
      if (key.leftArrow) {
        setColorCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.rightArrow) {
        setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + 1));
        return;
      }
      if (key.upArrow) {
        setColorCursor((c) => Math.max(0, c - COLS));
        return;
      }
      if (key.downArrow) {
        setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + COLS));
        return;
      }
      if (key.return) {
        const chosen = CHAT_COLORS[colorCursor]!;
        setLoading(true);
        try {
          await updateUserChatColor(currentUser.id, chosen);
          onUserUpdated({ ...currentUser, chat_color: chosen });
          setMessage("Chat color updated.");
          setPickingColor(false);
        } catch {
          setError("Failed to update color.");
        }
        setLoading(false);
        return;
      }
      return;
    }

    if (editingPhone) {
      if (key.escape) {
        setEditingPhone(false);
        setPhoneInput(currentUser.phone ?? "");
        setError("");
      }
      return;
    }

    if (confirmLogout) {
      if (input === "y") {
        onLogout();
      } else {
        setConfirmLogout(false);
      }
      return;
    }

    if (confirmDelete) {
      if (input === "y") {
        setLoading(true);
        try {
          await deleteUser(currentUser.id);
          onLogout();
        } catch {
          setError("Failed to delete account.");
          setLoading(false);
        }
        setConfirmDelete(false);
      } else {
        setConfirmDelete(false);
      }
      return;
    }

    if (key.escape || input === "b") {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      setError("");
      setMessage("");
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(OPTIONS.length - 1, c + 1));
      setError("");
      setMessage("");
      return;
    }
    if (key.return) {
      if (currentOption === "color") {
        setPickingColor(true);
      } else if (currentOption === "phone") {
        setEditingPhone(true);
        setPhoneInput(currentUser.phone ?? "");
      } else if (currentOption === "logout") {
        setConfirmLogout(true);
      } else if (currentOption === "delete") {
        setConfirmDelete(true);
      }
    }
  });

  async function handlePhoneSave() {
    const phone = phoneInput.trim() || null;
    if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
      setError("Phone must be E.164 format, e.g. +12223334444");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updateUserPhone(currentUser.id, phone);
      onUserUpdated({ ...currentUser, phone });
      setMessage("Phone updated.");
      setEditingPhone(false);
    } catch {
      setError("Failed to update phone.");
    }
    setLoading(false);
  }

  if (loading) return <Loader label="Saving..." />;

  const optionLabel: Record<Option, string> = {
    color: "Chat Color",
    phone: "Update Phone Number",
    logout: "Log Out",
    delete: "Delete Account",
  };

  const roleColor = ROLE_COLORS[currentUser.role] ?? PRIMARY;
  const displayColor = currentUser.chat_color ?? PRIMARY;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={FOCUS}>Settings</Text>
      </Box>

      <Box marginBottom={1} gap={2}>
        <Text color={TEXT_MUTED}>
          Signed in as{" "}
          <Text bold color={displayColor}>{currentUser.username}</Text>
          {" "}
          <Text color={roleColor}>[{currentUser.role}]</Text>
        </Text>
        {currentUser.phone ? (
          <Text color={DIM}>{currentUser.phone}</Text>
        ) : (
          <Text color={TEXT_DIM} dimColor>no phone set</Text>
        )}
      </Box>

      {confirmLogout && (
        <Box marginBottom={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>Log out? [y] Yes  [any key] Cancel</Text>
        </Box>
      )}

      {confirmDelete && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text color="red" bold>
            Permanently delete your account? This cannot be undone. [y] Yes  [any key] Cancel
          </Text>
        </Box>
      )}

      {editingPhone && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={BORDER_SUBTLE}
          padding={1}
          marginBottom={1}
        >
          <Text bold color={PRIMARY}>Update Phone Number</Text>
          <Text color={TEXT_DIM} dimColor>E.164 format, e.g. +12223334444  Leave blank to remove.</Text>
          <Box marginTop={1}>
            <Text color={TEXT_DIM}>› </Text>
            <TextInput
              value={phoneInput}
              onChange={setPhoneInput}
              onSubmit={handlePhoneSave}
              placeholder="+12223334444"
              focus={editingPhone}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[Enter] save  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      {pickingColor && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={BORDER_SUBTLE}
          padding={1}
          marginBottom={1}
        >
          <Box marginBottom={1} gap={2}>
            <Text bold color={PRIMARY}>Chat Color</Text>
            <Text color={TEXT_DIM} dimColor>Preview:</Text>
            <Text bold color={CHAT_COLORS[colorCursor]}>{currentUser.username}</Text>
          </Box>
          <Box flexDirection="column" gap={0}>
            {Array.from({ length: Math.ceil(CHAT_COLORS.length / COLS) }, (_, row) => (
              <Box key={row} gap={1}>
                {CHAT_COLORS.slice(row * COLS, row * COLS + COLS).map((color, col) => {
                  const idx = row * COLS + col;
                  const isSelected = idx === colorCursor;
                  return (
                    <Box key={color} width={4}>
                      <Text
                        bold={isSelected}
                        color={color}
                        backgroundColor={isSelected ? "#222222" : undefined}
                      >
                        {isSelected ? "[●]" : " ● "}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[←→↑↓] navigate  [Enter] select  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1}>
        {OPTIONS.map((opt, i) => {
          const isSelected = i === cursor;
          const textColor = opt === "delete" ? "red" : isSelected ? PRIMARY : TEXT_MUTED;

          return (
            <Box key={opt} gap={2}>
              <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>
                {isSelected ? "▶" : " "}
              </Text>
              <Text color={textColor} bold={isSelected}>
                {optionLabel[opt]}
              </Text>
              {opt === "color" && (
                <Text color={displayColor} bold>
                  ●
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={ERROR}>{error}</Text>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color={PRIMARY}>{message}</Text>
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "select" },
          { key: "b/Esc", label: "back" },
        ]}
      />
    </Box>
  );
}
