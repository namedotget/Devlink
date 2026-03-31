import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect } from "react";
import { getUsers, createUser, deleteUser, updateUserChatColor, updateUserRole } from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import { BORDER_SUBTLE, CHAT_COLORS, DIM, ERROR, FOCUS, PRIMARY, ROLE_COLORS, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import type { User, Role } from "../../types/index.js";

const ROLES: Role[] = ["dev", "lead", "manager"];

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return "•".repeat(phone.length);
  const prefix = phone.startsWith("+") ? "+" : "";
  const countryLen = digits.length > 10 ? digits.length - 10 : 1;
  return `${prefix}${digits.slice(0, countryLen)}${"•".repeat(6)}${digits.slice(-4)}`;
}

interface TeamManagementProps {
  onBack: () => void;
}

type FormField = "username" | "email" | "password" | "phone";
const FORM_FIELDS: FormField[] = ["username", "email", "password", "phone"];

const COLOR_COLS = 4;

type SubMode =
  | "list"
  | "create"
  | "createRole"
  | "confirmDelete"
  | "pickColor"
  | "changeRole";

export function TeamManagement({ onBack }: TeamManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<SubMode>("list");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [formField, setFormField] = useState<FormField>("username");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRoleCursor, setNewRoleCursor] = useState(0);

  const [colorCursor, setColorCursor] = useState(0);
  const [changeRoleCursor, setChangeRoleCursor] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const userData = await getUsers();
      setUsers(userData);
      setCursor((c) => Math.min(c, Math.max(0, userData.length - 1)));
    } catch {
      setError("Failed to load team.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const selectedUser = users[cursor];

  useInput(
    async (input, key) => {
      if (saving) return;
      setError("");
      setMessage("");

      if (mode === "create") {
        if (key.escape) {
          setMode("list");
          resetForm();
          return;
        }
        if (key.tab || key.return) {
          const currentIdx = FORM_FIELDS.indexOf(formField);
          if (key.return && formField === "phone") {
            setMode("createRole");
            return;
          }
          setFormField(FORM_FIELDS[(currentIdx + 1) % FORM_FIELDS.length]!);
          return;
        }
        return;
      }

      if (mode === "createRole") {
        if (key.escape) { setMode("create"); return; }
        if (key.upArrow) { setNewRoleCursor((c) => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setNewRoleCursor((c) => Math.min(ROLES.length - 1, c + 1)); return; }
        if (key.return) {
          await handleCreate();
          return;
        }
        return;
      }

      if (mode === "confirmDelete") {
        if (input === "y") {
          if (!selectedUser) return;
          setSaving(true);
          try {
            await deleteUser(selectedUser.id);
            setMessage(`User "${selectedUser.username}" deleted.`);
            await load();
          } catch {
            setError("Failed to delete user.");
          }
          setSaving(false);
          setMode("list");
        } else {
          setMode("list");
        }
        return;
      }

      if (mode === "pickColor") {
        if (key.escape) { setMode("list"); return; }
        if (key.leftArrow) { setColorCursor((c) => Math.max(0, c - 1)); return; }
        if (key.rightArrow) { setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + 1)); return; }
        if (key.upArrow) { setColorCursor((c) => Math.max(0, c - COLOR_COLS)); return; }
        if (key.downArrow) { setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + COLOR_COLS)); return; }
        if (key.return && selectedUser) {
          const chosen = CHAT_COLORS[colorCursor]!;
          setSaving(true);
          try {
            await updateUserChatColor(selectedUser.id, chosen);
            setMessage(`Color updated for ${selectedUser.username}.`);
            await load();
          } catch {
            setError("Failed to update color.");
          }
          setSaving(false);
          setMode("list");
          return;
        }
        return;
      }

      if (mode === "changeRole") {
        if (key.escape) { setMode("list"); return; }
        if (key.upArrow) { setChangeRoleCursor((c) => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setChangeRoleCursor((c) => Math.min(ROLES.length - 1, c + 1)); return; }
        if (key.return && selectedUser) {
          const role = ROLES[changeRoleCursor]!;
          setSaving(true);
          try {
            await updateUserRole(selectedUser.id, role);
            setMessage(`Role updated to [${role}] for ${selectedUser.username}.`);
            await load();
          } catch {
            setError("Failed to update role.");
          }
          setSaving(false);
          setMode("list");
          return;
        }
        return;
      }

      if (key.escape || input === "b") { onBack(); return; }
      if (key.upArrow) { setCursor((c) => Math.max(0, c - 1)); return; }
      if (key.downArrow) { setCursor((c) => Math.min(users.length - 1, c + 1)); return; }

      if (input === "n") {
        setMode("create");
        setFormField("username");
        return;
      }
      if (input === "d" && users.length > 0) { setMode("confirmDelete"); return; }
      if (input === "c" && selectedUser) {
        const currentIdx = CHAT_COLORS.indexOf(selectedUser.chat_color ?? "");
        setColorCursor(currentIdx >= 0 ? currentIdx : 0);
        setMode("pickColor");
        return;
      }
      if (input === "r" && selectedUser) {
        const currentIdx = ROLES.indexOf(selectedUser.role);
        setChangeRoleCursor(currentIdx >= 0 ? currentIdx : 0);
        setMode("changeRole");
        return;
      }
    },
    { isActive: !loading }
  );

  function resetForm() {
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setNewPhone("");
    setNewRoleCursor(0);
    setFormField("username");
  }

  async function handleCreate() {
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setError("Username, email, and password are required.");
      return;
    }
    const phone = newPhone.trim() || undefined;
    if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
      setError("Phone must be E.164 format, e.g. +12223334444");
      return;
    }
    const role = ROLES[newRoleCursor]!;
    setSaving(true);
    try {
      await createUser(newUsername.trim(), newEmail.trim(), newPassword.trim(), role, phone);
      setMessage(`User "${newUsername}" created as [${role}].`);
      resetForm();
      setMode("list");
      await load();
    } catch {
      setError("Failed to create user. Username may already exist.");
    }
    setSaving(false);
  }

  if (loading) return <Loader label="Loading team..." />;
  if (saving) return <Loader label="Saving..." />;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={FOCUS}>Team Management</Text>
      </Box>

      {mode === "confirmDelete" && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text color="red" bold>
            Delete user "{selectedUser?.username}" and all related data? [y] Yes  [any key] Cancel
          </Text>
        </Box>
      )}

      {mode === "pickColor" && selectedUser && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Box marginBottom={1} gap={2}>
            <Text bold color={PRIMARY}>Override Color for {selectedUser.username}</Text>
            <Text color={TEXT_DIM} dimColor>Preview:</Text>
            <Text bold color={CHAT_COLORS[colorCursor]}>{selectedUser.username}</Text>
          </Box>
          <Box flexDirection="column">
            {Array.from({ length: Math.ceil(CHAT_COLORS.length / COLOR_COLS) }, (_, row) => (
              <Box key={row} gap={1}>
                {CHAT_COLORS.slice(row * COLOR_COLS, row * COLOR_COLS + COLOR_COLS).map((color, col) => {
                  const idx = row * COLOR_COLS + col;
                  const isSelected = idx === colorCursor;
                  return (
                    <Box key={color} width={4}>
                      <Text bold={isSelected} color={color} backgroundColor={isSelected ? "#222222" : undefined}>
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

      {mode === "changeRole" && selectedUser && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold color={PRIMARY}>Change role for {selectedUser.username}</Text>
          </Box>
          {ROLES.map((role, i) => {
            const isSelected = i === changeRoleCursor;
            const isCurrent = role === selectedUser.role;
            return (
              <Box key={role} gap={2}>
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                <Text color={ROLE_COLORS[role] ?? PRIMARY} bold={isSelected}>[{role}]</Text>
                {isCurrent && <Text color={TEXT_DIM} dimColor>current</Text>}
              </Box>
            );
          })}
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[↑↓] navigate  [Enter] confirm  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
        {users.length === 0 ? (
          <Text color={TEXT_DIM} dimColor>No users found.</Text>
        ) : (
          users.map((user, i) => {
            const isSelected = i === cursor;
            const roleColor = ROLE_COLORS[user.role] ?? TEXT_MUTED;
            const chatColor = user.chat_color ?? PRIMARY;
            return (
              <Box key={user.id} gap={1} flexWrap="wrap">
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                <Text color={chatColor} bold={isSelected}>●</Text>
                <Text color={isSelected ? PRIMARY : TEXT_MUTED} bold={isSelected}>{user.username}</Text>
                <Text color={roleColor}>[{user.role}]</Text>
                <Text color={DIM}>{user.email}</Text>
                {user.phone ? (
                  <Text color={DIM}>{maskPhone(user.phone)}</Text>
                ) : (
                  <Text color={TEXT_DIM} dimColor>no phone</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {(mode === "create" || mode === "createRole") && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Text bold color={PRIMARY}>New User</Text>

          {mode === "create" && FORM_FIELDS.map((f) => (
            <Box key={f} flexDirection="column" marginTop={1}>
              <Box gap={1}>
                <Text color={formField === f ? FOCUS : TEXT_MUTED} bold={formField === f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
                {f === "phone" && <Text color={TEXT_DIM} dimColor>(optional, E.164)</Text>}
              </Box>
              <Box>
                <Text color={DIM}>› </Text>
                {f === "username" && (
                  <TextInput value={newUsername} onChange={setNewUsername} focus={formField === "username"} placeholder="username" />
                )}
                {f === "email" && (
                  <TextInput value={newEmail} onChange={setNewEmail} focus={formField === "email"} placeholder="email@example.com" />
                )}
                {f === "password" && (
                  <TextInput value={newPassword} onChange={setNewPassword} focus={formField === "password"} mask="*" placeholder="password" />
                )}
                {f === "phone" && (
                  <TextInput value={newPhone} onChange={setNewPhone} focus={formField === "phone"} placeholder="+12223334444" />
                )}
              </Box>
            </Box>
          ))}

          {mode === "createRole" && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={PRIMARY} bold>Select role</Text>
              <Box flexDirection="column" marginTop={1}>
                {ROLES.map((role, i) => {
                  const isSelected = i === newRoleCursor;
                  return (
                    <Box key={role} gap={2}>
                      <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                      <Text color={ROLE_COLORS[role] ?? PRIMARY} bold={isSelected}>[{role}]</Text>
                    </Box>
                  );
                })}
              </Box>
              <Box marginTop={1}>
                <Text color={TEXT_DIM} dimColor>[↑↓] navigate  [Enter] create  [Esc] back</Text>
              </Box>
            </Box>
          )}

          {mode === "create" && (
            <Box marginTop={1}>
              <Text color={TEXT_DIM} dimColor>[Tab/Enter] next field  [Enter on Phone] continue  [Esc] cancel</Text>
            </Box>
          )}
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "n", label: "new user" },
          { key: "r", label: "change role" },
          { key: "d", label: "delete" },
          { key: "c", label: "set color" },
          { key: "b/Esc", label: "back" },
        ]}
        message={message}
        error={error}
      />
    </Box>
  );
}
