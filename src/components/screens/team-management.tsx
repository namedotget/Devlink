import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect } from "react";
import { getUsers, createUser, deleteUser, updateUserChatColor, getRoles, assignRole, removeRole } from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import { BORDER_SUBTLE, CHAT_COLORS, DIM, ERROR, FOCUS, PRIMARY, ROLE_COLORS, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import type { User, CustomRole } from "../../types/index.js";

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
  | "confirmDelete"
  | "pickColor"
  | "assignRoles";

export function TeamManagement({ onBack }: TeamManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [allRoles, setAllRoles] = useState<CustomRole[]>([]);
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

  const [colorCursor, setColorCursor] = useState(0);

  const [roleCursor, setRoleCursor] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [userData, roleData] = await Promise.all([getUsers(), getRoles()]);
      setUsers(userData);
      setAllRoles(roleData);
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
            await handleCreate();
            return;
          }
          setFormField(FORM_FIELDS[(currentIdx + 1) % FORM_FIELDS.length]!);
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

      if (mode === "assignRoles") {
        if (key.escape) { setMode("list"); return; }
        if (key.upArrow) { setRoleCursor((c) => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setRoleCursor((c) => Math.min(allRoles.length - 1, c + 1)); return; }
        if (key.return && selectedUser) {
          const role = allRoles[roleCursor];
          if (!role) return;
          const hasRole = (selectedUser.custom_roles ?? []).some((r) => r.id === role.id);
          setSaving(true);
          try {
            if (hasRole) {
              await removeRole(selectedUser.id, role.id);
              setMessage(`Removed [${role.name}] from ${selectedUser.username}.`);
            } else {
              await assignRole(selectedUser.id, role.id);
              setMessage(`Assigned [${role.name}] to ${selectedUser.username}.`);
            }
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
      if (input === "x" && selectedUser) {
        setRoleCursor(0);
        setMode("assignRoles");
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
    setSaving(true);
    try {
      await createUser(newUsername.trim(), newEmail.trim(), newPassword.trim(), "dev", phone);
      setMessage(`Dev "${newUsername}" created.`);
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

      {mode === "assignRoles" && selectedUser && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold color={PRIMARY}>
              Roles for {selectedUser.username}  (Enter to toggle)
            </Text>
          </Box>
          {allRoles.map((role, i) => {
            const hasRole = (selectedUser.custom_roles ?? []).some((r) => r.id === role.id);
            const isSelected = i === roleCursor;
            return (
              <Box key={role.id} gap={2}>
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                <Text color={hasRole ? role.color : TEXT_MUTED} bold={hasRole}>[{role.name}]</Text>
                <Text color={TEXT_DIM} dimColor>{hasRole ? "assigned" : "not assigned"}</Text>
                {role.can_assign_tasks && <Text color={TEXT_DIM} dimColor>can assign tasks</Text>}
              </Box>
            );
          })}
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[↑↓] navigate  [Enter] toggle  [Esc] back</Text>
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
            const customRoles = user.custom_roles ?? [];
            return (
              <Box key={user.id} gap={1} flexWrap="wrap">
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                <Text color={chatColor} bold={isSelected}>●</Text>
                <Text color={isSelected ? PRIMARY : TEXT_MUTED} bold={isSelected}>{user.username}</Text>
                <Text color={roleColor}>[{user.role}]</Text>
                {customRoles.map((r) => (
                  <Text key={r.id} color={r.color}>[{r.name}]</Text>
                ))}
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

      {mode === "create" && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Text bold color={PRIMARY}>New Dev Account</Text>
          {FORM_FIELDS.map((f) => (
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
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[Tab/Enter] next field  [Enter on Phone] create  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "n", label: "new dev" },
          { key: "d", label: "delete" },
          { key: "c", label: "set color" },
          { key: "x", label: "assign roles" },
          { key: "b/Esc", label: "back" },
        ]}
        message={message}
        error={error}
      />
    </Box>
  );
}
