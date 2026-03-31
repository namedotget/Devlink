import { Box, Text, useInput } from "ink";
import { useState, useEffect } from "react";
import { getAllTasks, deleteTask, updateTask, getNextTaskStatus, getPreviousTaskStatus, canUserTransitionTaskStatus } from "../../lib/api.js";
import { truncateText } from "../../lib/text.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import {
  BORDER_SUBTLE,
  FOCUS,
  PRIMARY,
  TEXT_DIM,
  TEXT_MUTED,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from "../theme.js";
import type { User, Task } from "../../types/index.js";

const ROW_DIVIDER = "────────────────────────────────────────────────────────────────";

interface ManagerDashboardProps {
  currentUser: User;
  onViewTask: (taskId: number) => void;
  onNewTask: () => void;
  onEditTask: (taskId: number) => void;
  onTeam: () => void;
  onMessaging: () => void;
  onSettings: () => void;
}

export function ManagerDashboard({
  currentUser,
  onViewTask,
  onNewTask,
  onEditTask,
  onTeam,
  onMessaging,
  onSettings,
}: ManagerDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskCursor, setTaskCursor] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const data = await getAllTasks();
      setTasks(data);
      setTaskCursor((c) => Math.min(c, Math.max(0, data.length - 1)));
    } catch {
      setError("Failed to load tasks.");
    }
    if (showLoader) setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useInput(
    async (input, key) => {
      if (loading) return;

      if (confirmDelete) {
        if (input === "y") {
          const task = tasks[taskCursor];
          if (!task) return;
          try {
            await deleteTask(task.id);
            setMessage(`Task "${task.title}" deleted.`);
            await load();
          } catch {
            setError("Failed to delete task.");
          }
          setConfirmDelete(false);
        } else {
          setConfirmDelete(false);
          setMessage("Delete cancelled.");
        }
        return;
      }

      setError("");
      setMessage("");

      if (key.upArrow) {
        setTaskCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setTaskCursor((c) => Math.min(tasks.length - 1, c + 1));
        return;
      }
      if (key.leftArrow && tasks.length > 0) {
        const task = tasks[taskCursor];
        if (!task) return;
        const previousStatus = getPreviousTaskStatus(task.status);
        if (!previousStatus) return;
        const permission = canUserTransitionTaskStatus({
          user: currentUser,
          task,
          targetStatus: previousStatus,
        });
        if (!permission.allowed) {
          setError(permission.reason ?? "Status transition is not allowed.");
          return;
        }
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: previousStatus } : t)),
        );
        setMessage(`Task moved to ${STATUS_LABELS[previousStatus]}.`);
        updateTask(
          task.id,
          { title: task.title, description: task.description, status: previousStatus, priority: task.priority, assigned_to: task.assigned_to },
          currentUser.id,
        ).catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
          setMessage("");
          setError("Failed to update task status.");
        });
        return;
      }
      if (key.rightArrow && tasks.length > 0) {
        const task = tasks[taskCursor];
        if (!task) return;
        const nextStatus = getNextTaskStatus(task.status);
        if (!nextStatus) return;
        const permission = canUserTransitionTaskStatus({
          user: currentUser,
          task,
          targetStatus: nextStatus,
        });
        if (!permission.allowed) {
          setError(permission.reason ?? "Status transition is not allowed.");
          return;
        }
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
        );
        setMessage(`Task moved to ${STATUS_LABELS[nextStatus]}.`);
        updateTask(
          task.id,
          { title: task.title, description: task.description, status: nextStatus, priority: task.priority, assigned_to: task.assigned_to },
          currentUser.id,
        ).catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
          setMessage("");
          setError("Failed to update task status.");
        });
        return;
      }
      if (key.return && tasks.length > 0) {
        onViewTask(tasks[taskCursor]!.id);
        return;
      }
      if (input === "n") {
        onNewTask();
        return;
      }
      if (input === "e" && tasks.length > 0) {
        onEditTask(tasks[taskCursor]!.id);
        return;
      }
      if (input === "d" && tasks.length > 0) {
        setConfirmDelete(true);
        return;
      }
      if (input === "r") {
            await load(false);
        return;
      }
      if (input === "t") {
        onTeam();
        return;
      }
      if (input === "m") {
        onMessaging();
        return;
      }
      if (input === "s") {
        onSettings();
        return;
      }
    },
    { isActive: !loading },
  );

  const stats = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) return <Loader label="Loading tasks..." />;

  return (
    <Box flexDirection="column" padding={1} width="100%">
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={FOCUS}>
          Manager Dashboard
        </Text>
        <Text color={TEXT_MUTED}>
          Welcome,{" "}
          <Text color={PRIMARY} bold>
            {currentUser.username}
          </Text>
        </Text>
      </Box>

      <Box
        gap={3}
        marginBottom={1}
        borderStyle="single"
        borderColor={BORDER_SUBTLE}
        paddingX={1}
      >
        <Text color={TEXT_MUTED}>
          Todo:{" "}
          <Text color="yellow" bold>
            {stats["todo"] ?? 0}
          </Text>
        </Text>
        <Text color={TEXT_MUTED}>
          WIP:{" "}
          <Text color={PRIMARY} bold>
            {stats["wip"] ?? 0}
          </Text>
        </Text>
        <Text color={TEXT_MUTED}>
          Review:{" "}
          <Text color="#87CEEB" bold>
            {stats["review"] ?? 0}
          </Text>
        </Text>
        <Text color={TEXT_MUTED}>
          Done:{" "}
          <Text color={TEXT_DIM} bold>
            {stats["done"] ?? 0}
          </Text>
        </Text>
        <Text color={TEXT_MUTED}>
          Total: <Text bold>{tasks.length}</Text>
        </Text>
      </Box>

      {confirmDelete && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text color="red" bold>
            Delete "{tasks[taskCursor]?.title}"? [y] Yes [any key] Cancel
          </Text>
        </Box>
      )}


      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        padding={1}
      >
        {tasks.length === 0 ? (
          <Text color={TEXT_DIM} dimColor>
            No tasks yet. Press [n] to create one.
          </Text>
        ) : (
          tasks.map((task, i) => {
            const isSelected = i === taskCursor;
            return (
              <Box key={task.id} flexDirection="column" marginBottom={1}>
                <Box gap={1}>
                  <Text color={isSelected ? FOCUS : TEXT_MUTED} bold={isSelected}>
                    {isSelected ? "▶" : " "}
                  </Text>
                  <Text
                    color={STATUS_COLORS[task.status] ?? PRIMARY}
                    bold={isSelected}
                  >
                    [{STATUS_LABELS[task.status]}]
                  </Text>
                  <Text color={PRIORITY_COLORS[task.priority] ?? TEXT_MUTED}>
                    [{PRIORITY_LABELS[task.priority]}]
                  </Text>
                  <Text
                    color={isSelected ? PRIMARY : TEXT_MUTED}
                    bold={isSelected}
                  >
                    {task.title}
                  </Text>
                  <Text color={TEXT_DIM} dimColor>
                    → {task.assignee_name ?? "unassigned"}
                  </Text>
                </Box>
                {task.description.trim() ? (
                  <Box marginLeft={2}>
                    <Text color={TEXT_DIM}>{truncateText(task.description, 68)}</Text>
                  </Box>
                ) : null}
                {i < tasks.length - 1 ? (
                  <Box marginTop={1}>
                    <Text color={BORDER_SUBTLE}>{ROW_DIVIDER}</Text>
                  </Box>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>

      <StatusBar
        bindings={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "view" },
          { key: "←→", label: "status" },
          { key: "n", label: "new" },
          { key: "e", label: "edit" },
          { key: "d", label: "delete" },
          { key: "r", label: "refresh" },
          { key: "t", label: "team" },
          { key: "m", label: "messages" },
          { key: "s", label: "settings" },
        ]}
        message={message}
        error={error}
      />
    </Box>
  );
}
