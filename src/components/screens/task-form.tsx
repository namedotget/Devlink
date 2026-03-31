import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect } from "react";
import {
  createTask,
  updateTask,
  getTaskById,
  canAssignTasks,
  getDevs,
} from "../../lib/api.js";
import { Select } from "../ui/select.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import {
  ACCENT_SOFT,
  BORDER_SUBTLE,
  ERROR,
  FOCUS,
  PRIMARY,
  TEXT_MUTED,
} from "../theme.js";
import type {
  User,
  Task,
  TaskStatus,
  TaskPriority,
} from "../../types/index.js";

interface TaskFormProps {
  currentUser: User;
  editingTaskId: number | null;
  onSave: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = [
  { label: "Todo", value: "todo" as TaskStatus },
  { label: "WIP", value: "wip" as TaskStatus },
  { label: "Review", value: "review" as TaskStatus },
  { label: "Done", value: "done" as TaskStatus },
];

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low" as TaskPriority },
  { label: "Medium", value: "medium" as TaskPriority },
  { label: "High", value: "high" as TaskPriority },
];

export function TaskForm({
  currentUser,
  editingTaskId,
  onSave,
  onCancel,
}: TaskFormProps) {
  const canAssign = canAssignTasks(currentUser);
  const FIELDS = canAssign
    ? (["title", "description", "status", "priority", "assignee"] as const)
    : (["title", "description", "status", "priority"] as const);

  type Field = (typeof FIELDS)[number];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldIndex, setFieldIndex] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<number | null>(
    canAssign ? null : currentUser.id,
  );
  const [devs, setDevs] = useState<User[]>([]);

  const isEditing = editingTaskId !== null;
  const currentField: Field = FIELDS[fieldIndex]!;

  useEffect(() => {
    async function load() {
      const [devsData, task] = await Promise.all([
        canAssign ? getDevs() : Promise.resolve([]),
        isEditing ? getTaskById(editingTaskId) : Promise.resolve(null),
      ]);
      setDevs(devsData);
      if (task) {
        setTitle(task.title);
        setDescription(task.description);
        setStatus(task.status);
        setPriority(task.priority);
        setAssigneeId(task.assigned_to);
      }
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [editingTaskId]);

  const assigneeOptions = [
    { label: "Unassigned", value: "null" },
    ...devs.map((d) => ({ label: d.username, value: String(d.id) })),
  ];

  const assigneeValue = assigneeId === null ? "null" : String(assigneeId);

  useInput(
    (input, key) => {
      if (saving) return;

      if (key.escape) {
        onCancel();
        return;
      }

      if (key.tab) {
        setFieldIndex((i) => (i + 1) % FIELDS.length);
        return;
      }

      if (key.shift && key.tab) {
        setFieldIndex((i) => (i - 1 + FIELDS.length) % FIELDS.length);
        return;
      }

      if (key.return) {
        void handleSave();
      }
    },
    { isActive: !loading },
  );

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const resolved = canAssign ? assigneeId : currentUser.id;
      if (isEditing) {
        await updateTask(
          editingTaskId,
          {
            title: title.trim(),
            description: description.trim(),
            status,
            priority,
            assigned_to: resolved,
          },
          currentUser.id,
        );
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          created_by: currentUser.id,
          assigned_to: resolved,
        });
      }
      onSave();
    } catch {
      setError("Failed to save task.");
      setSaving(false);
    }
  }

  if (loading) return <Loader label="Loading form..." />;
  if (saving) return <Loader label="Saving..." />;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={FOCUS}>
          {isEditing ? "Edit Task" : "New Task"}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        padding={1}
        gap={1}
      >
        <FieldRow label="Title" active={currentField === "title"}>
          <TextInput
            value={title}
            onChange={setTitle}
            focus={currentField === "title"}
            placeholder="Task title..."
          />
        </FieldRow>

        <FieldRow label="Description" active={currentField === "description"}>
          <TextInput
            value={description}
            onChange={setDescription}
            focus={currentField === "description"}
            placeholder="Optional description..."
          />
        </FieldRow>

        <FieldRow label="Status" active={currentField === "status"}>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            isFocused={currentField === "status"}
          />
        </FieldRow>

        <FieldRow label="Priority" active={currentField === "priority"}>
          <Select
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
            isFocused={currentField === "priority"}
          />
        </FieldRow>

        {canAssign && (
          <FieldRow label="Assign To" active={currentField === "assignee"}>
            <Select
              options={assigneeOptions}
              value={assigneeValue}
              onChange={(v) => setAssigneeId(v === "null" ? null : Number(v))}
              isFocused={currentField === "assignee"}
            />
          </FieldRow>
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "Tab", label: "next field" },
          { key: "Shift+Tab", label: "prev field" },
          { key: "↑↓", label: "change value" },
          { key: "Enter", label: "save" },
          { key: "Esc", label: "cancel" },
        ]}
        error={error}
      />
    </Box>
  );
}

function FieldRow({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box flexDirection="column">
      <Text color={active ? FOCUS : TEXT_MUTED} bold={active}>
        {label}
      </Text>
      <Box marginLeft={1}>
        <Text color={ACCENT_SOFT}>› </Text>
        {children}
      </Box>
    </Box>
  );
}
