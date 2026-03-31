import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect } from "react";
import { getRoles, createRole, updateRole, deleteRole, assignRole, removeRole, getUsers } from "../../lib/api.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import { BORDER_SUBTLE, CHAT_COLORS, DIM, ERROR, FOCUS, PRIMARY, TEXT_DIM, TEXT_MUTED } from "../theme.js";
import type { CustomRole, User } from "../../types/index.js";

interface RoleManagementProps {
  onBack: () => void;
}

type SubMode =
  | "list"
  | "create"
  | "editColor"
  | "editName"
  | "confirmDelete"
  | "pickUser"
  | "removeFromUser";

const COLOR_COLS = 4;

export function RoleManagement({ onBack }: RoleManagementProps) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [userCursor, setUserCursor] = useState(0);
  const [colorCursor, setColorCursor] = useState(0);
  const [mode, setMode] = useState<SubMode>("list");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [newColorIdx, setNewColorIdx] = useState(0);
  const [newCanAssign, setNewCanAssign] = useState(false);
  const [createStep, setCreateStep] = useState<"name" | "color" | "permission">("name");

  const [editNameInput, setEditNameInput] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [roleData, userData] = await Promise.all([getRoles(), getUsers()]);
      setRoles(roleData);
      setUsers(userData);
      setCursor((c) => Math.min(c, Math.max(0, roleData.length - 1)));
    } catch {
      setError("Failed to load roles.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const selectedRole = roles[cursor];

  useInput(
    async (input, key) => {
      if (saving) return;
      setError("");
      setMessage("");

      if (mode === "create") {
        if (key.escape) { setMode("list"); resetCreate(); return; }

        if (createStep === "name") {
          if (key.return) {
            if (!newName.trim()) { setError("Name is required."); return; }
            setCreateStep("color");
          }
          return;
        }

        if (createStep === "color") {
          if (key.leftArrow) { setNewColorIdx((c) => Math.max(0, c - 1)); return; }
          if (key.rightArrow) { setNewColorIdx((c) => Math.min(CHAT_COLORS.length - 1, c + 1)); return; }
          if (key.upArrow) { setNewColorIdx((c) => Math.max(0, c - COLOR_COLS)); return; }
          if (key.downArrow) { setNewColorIdx((c) => Math.min(CHAT_COLORS.length - 1, c + COLOR_COLS)); return; }
          if (key.return) { setCreateStep("permission"); return; }
          return;
        }

        if (createStep === "permission") {
          if (input === "y") { setNewCanAssign(true); await handleCreate(true); return; }
          if (input === "n") { setNewCanAssign(false); await handleCreate(false); return; }
          if (key.return) { await handleCreate(newCanAssign); return; }
          return;
        }

        return;
      }

      if (mode === "editName") {
        if (key.escape) { setMode("list"); return; }
        if (key.return) {
          if (!selectedRole || selectedRole.is_system) return;
          if (!editNameInput.trim()) { setError("Name cannot be empty."); return; }
          setSaving(true);
          try {
            await updateRole(selectedRole.id, { name: editNameInput.trim() });
            setMessage("Role name updated.");
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

      if (mode === "editColor") {
        if (key.escape) { setMode("list"); return; }
        if (key.leftArrow) { setColorCursor((c) => Math.max(0, c - 1)); return; }
        if (key.rightArrow) { setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + 1)); return; }
        if (key.upArrow) { setColorCursor((c) => Math.max(0, c - COLOR_COLS)); return; }
        if (key.downArrow) { setColorCursor((c) => Math.min(CHAT_COLORS.length - 1, c + COLOR_COLS)); return; }
        if (key.return && selectedRole && !selectedRole.is_system) {
          const chosen = CHAT_COLORS[colorCursor]!;
          setSaving(true);
          try {
            await updateRole(selectedRole.id, { color: chosen });
            setMessage(`Color updated for [${selectedRole.name}].`);
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

      if (mode === "confirmDelete") {
        if (input === "y" && selectedRole && !selectedRole.is_system) {
          setSaving(true);
          try {
            await deleteRole(selectedRole.id);
            setMessage(`Role "${selectedRole.name}" deleted.`);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete role.");
          }
          setSaving(false);
          setMode("list");
        } else {
          setMode("list");
        }
        return;
      }

      if (mode === "pickUser") {
        if (key.escape) { setMode("list"); return; }
        if (key.upArrow) { setUserCursor((c) => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setUserCursor((c) => Math.min(users.length - 1, c + 1)); return; }
        if (key.return && selectedRole) {
          const user = users[userCursor];
          if (!user) return;
          setSaving(true);
          try {
            await assignRole(user.id, selectedRole.id);
            setMessage(`Assigned [${selectedRole.name}] to ${user.username}.`);
            await load();
          } catch {
            setError("Failed to assign role.");
          }
          setSaving(false);
          setMode("list");
          return;
        }
        return;
      }

      if (mode === "removeFromUser") {
        if (key.escape) { setMode("list"); return; }
        if (key.upArrow) { setUserCursor((c) => Math.max(0, c - 1)); return; }
        if (key.downArrow) { setUserCursor((c) => Math.min(users.length - 1, c + 1)); return; }
        if (key.return && selectedRole) {
          const user = users[userCursor];
          if (!user) return;
          setSaving(true);
          try {
            await removeRole(user.id, selectedRole.id);
            setMessage(`Removed [${selectedRole.name}] from ${user.username}.`);
            await load();
          } catch {
            setError("Failed to remove role.");
          }
          setSaving(false);
          setMode("list");
          return;
        }
        return;
      }

      if (key.escape || input === "b") { onBack(); return; }
      if (key.upArrow) { setCursor((c) => Math.max(0, c - 1)); return; }
      if (key.downArrow) { setCursor((c) => Math.min(roles.length - 1, c + 1)); return; }

      if (input === "n") {
        resetCreate();
        setMode("create");
        return;
      }
      if (input === "e" && selectedRole && !selectedRole.is_system) {
        setEditNameInput(selectedRole.name);
        setMode("editName");
        return;
      }
      if (input === "c" && selectedRole && !selectedRole.is_system) {
        const idx = CHAT_COLORS.indexOf(selectedRole.color);
        setColorCursor(idx >= 0 ? idx : 0);
        setMode("editColor");
        return;
      }
      if (input === "d" && selectedRole && !selectedRole.is_system) {
        setMode("confirmDelete");
        return;
      }
      if (input === "a" && selectedRole) {
        setUserCursor(0);
        setMode("pickUser");
        return;
      }
      if (input === "r" && selectedRole) {
        setUserCursor(0);
        setMode("removeFromUser");
        return;
      }
    },
    { isActive: !loading }
  );

  function resetCreate() {
    setNewName("");
    setNewColorIdx(0);
    setNewCanAssign(false);
    setCreateStep("name");
  }

  async function handleCreate(canAssign: boolean) {
    if (!newName.trim()) { setError("Name is required."); return; }
    setSaving(true);
    try {
      await createRole(newName.trim(), CHAT_COLORS[newColorIdx]!, canAssign);
      setMessage(`Role "${newName}" created.`);
      resetCreate();
      setMode("list");
      await load();
    } catch {
      setError("Failed to create role. Name may already exist.");
    }
    setSaving(false);
  }

  if (loading) return <Loader label="Loading roles..." />;
  if (saving) return <Loader label="Saving..." />;

  const usersWithRole = selectedRole
    ? users.filter((u) => (u.custom_roles ?? []).some((r) => r.id === selectedRole.id))
    : [];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={FOCUS}>Role Management</Text>
      </Box>

      {mode === "confirmDelete" && selectedRole && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text color="red" bold>
            Delete role "{selectedRole.name}"? This will remove it from all users. [y] Yes  [any key] Cancel
          </Text>
        </Box>
      )}

      {mode === "create" && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Text bold color={PRIMARY}>New Role</Text>

          {createStep === "name" && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={PRIMARY}>Name</Text>
              <Box>
                <Text color={DIM}>{"> "}</Text>
                <TextInput
                  value={newName}
                  onChange={setNewName}
                  focus={true}
                  placeholder="e.g. Frontend, Backend, DevOps"
                />
              </Box>
              <Box marginTop={1}>
                <Text color={TEXT_DIM} dimColor>[Enter] next  [Esc] cancel</Text>
              </Box>
            </Box>
          )}

          {createStep === "color" && (
            <Box flexDirection="column" marginTop={1}>
              <Box gap={2} marginBottom={1}>
                <Text color={PRIMARY} bold>Pick Color</Text>
                <Text color={TEXT_DIM} dimColor>Preview:</Text>
                <Text bold color={CHAT_COLORS[newColorIdx]}>[{newName}]</Text>
              </Box>
              <Box flexDirection="column">
                {Array.from({ length: Math.ceil(CHAT_COLORS.length / COLOR_COLS) }, (_, row) => (
                  <Box key={row} gap={1}>
                    {CHAT_COLORS.slice(row * COLOR_COLS, row * COLOR_COLS + COLOR_COLS).map((color, col) => {
                      const idx = row * COLOR_COLS + col;
                      const isSel = idx === newColorIdx;
                      return (
                        <Box key={color} width={4}>
                          <Text bold={isSel} color={color} backgroundColor={isSel ? "#222222" : undefined}>
                            {isSel ? "[●]" : " ● "}
                          </Text>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
              <Box marginTop={1}>
                <Text color={TEXT_DIM} dimColor>[←→↑↓] navigate  [Enter] confirm  [Esc] cancel</Text>
              </Box>
            </Box>
          )}

          {createStep === "permission" && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={PRIMARY} bold>Can this role assign tasks?</Text>
              <Box gap={2} marginTop={1}>
                <Text color={TEXT_DIM} dimColor>[y] Yes  [n] No</Text>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {mode === "editName" && selectedRole && !selectedRole.is_system && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Text bold color={PRIMARY}>Rename [{selectedRole.name}]</Text>
          <Box marginTop={1}>
            <Text color={TEXT_DIM}>› </Text>
            <TextInput
              value={editNameInput}
              onChange={setEditNameInput}
              focus={true}
              placeholder={selectedRole.name}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[Enter] save  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      {mode === "editColor" && selectedRole && !selectedRole.is_system && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Box gap={2} marginBottom={1}>
            <Text bold color={PRIMARY}>Color for [{selectedRole.name}]</Text>
            <Text color={TEXT_DIM} dimColor>Preview:</Text>
            <Text bold color={CHAT_COLORS[colorCursor]}>[{selectedRole.name}]</Text>
          </Box>
          <Box flexDirection="column">
            {Array.from({ length: Math.ceil(CHAT_COLORS.length / COLOR_COLS) }, (_, row) => (
              <Box key={row} gap={1}>
                {CHAT_COLORS.slice(row * COLOR_COLS, row * COLOR_COLS + COLOR_COLS).map((color, col) => {
                  const idx = row * COLOR_COLS + col;
                  const isSel = idx === colorCursor;
                  return (
                    <Box key={color} width={4}>
                      <Text bold={isSel} color={color} backgroundColor={isSel ? "#222222" : undefined}>
                        {isSel ? "[●]" : " ● "}
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

      {(mode === "pickUser" || mode === "removeFromUser") && selectedRole && (
        <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1} marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold color={PRIMARY}>
              {mode === "pickUser"
                ? `Assign [${selectedRole.name}] to:`
                : `Remove [${selectedRole.name}] from:`}
            </Text>
          </Box>
          {users.length === 0 ? (
            <Text color={TEXT_DIM} dimColor>No users found.</Text>
          ) : (
            users.map((user, i) => {
              const hasRole = (user.custom_roles ?? []).some((r) => r.id === selectedRole.id);
              const isSelected = i === userCursor;
              return (
                <Box key={user.id} gap={2}>
                  <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                  <Text color={isSelected ? PRIMARY : TEXT_MUTED} bold={isSelected}>{user.username}</Text>
                  <Text color={TEXT_DIM} dimColor>[{user.role}]</Text>
                  {hasRole && <Text color={selectedRole.color}>[has role]</Text>}
                </Box>
              );
            })
          )}
          <Box marginTop={1}>
            <Text color={TEXT_DIM} dimColor>[↑↓] navigate  [Enter] confirm  [Esc] cancel</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" borderStyle="round" borderColor={BORDER_SUBTLE} padding={1}>
        {roles.length === 0 ? (
          <Text color={TEXT_DIM} dimColor>No roles found.</Text>
        ) : (
          roles.map((role, i) => {
            const isSelected = i === cursor;
            const assigneeCount = users.filter((u) =>
              (u.custom_roles ?? []).some((r) => r.id === role.id)
            ).length;
            return (
              <Box key={role.id} gap={2}>
                <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>{isSelected ? "▶" : " "}</Text>
                <Text color={role.color} bold>[{role.name}]</Text>
                {role.is_system && <Text color={DIM} dimColor>system</Text>}
                {role.can_assign_tasks && <Text color={TEXT_DIM} dimColor>can assign tasks</Text>}
                <Text color={TEXT_DIM} dimColor>{assigneeCount} {assigneeCount === 1 ? "member" : "members"}</Text>
                {isSelected && usersWithRole.length > 0 && (
                  <Text color={TEXT_DIM} dimColor>
                    ({usersWithRole.map((u) => u.username).join(", ")})
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "n", label: "new role" },
          { key: "e", label: "rename" },
          { key: "c", label: "color" },
          { key: "d", label: "delete" },
          { key: "a", label: "assign user" },
          { key: "r", label: "remove user" },
          { key: "b/Esc", label: "back" },
        ]}
        message={message}
        error={error}
      />
    </Box>
  );
}
