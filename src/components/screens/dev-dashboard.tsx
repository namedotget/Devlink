import { Box, Text, useInput } from "ink";
import { useState, useEffect } from "react";
import { getTasksByAssignee, updateTask, getNextTaskStatus, getPreviousTaskStatus, canUserTransitionTaskStatus } from "../../lib/api.js";
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
  ROLE_COLORS,
} from "../theme.js";
import type { User, Task } from "../../types/index.js";

const ROW_DIVIDER = "────────────────────────────────────────────────────────────────";

interface DevDashboardProps {
  currentUser: User;
  onViewTask: (taskId: number) => void;
  onNewTask?: () => void;
  onMessaging: () => void;
  onSettings: () => void;
}

export function DevDashboard({
  currentUser,
  onViewTask,
  onNewTask,
  onMessaging,
  onSettings,
}: DevDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskCursor, setTaskCursor] = useState(0);
  const [error, setError] = useState("");

  async function load(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const data = await getTasksByAssignee(currentUser.id);
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
      setError("");

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
        updateTask(
          task.id,
          { title: task.title, description: task.description, status: previousStatus, priority: task.priority, assigned_to: task.assigned_to },
          currentUser.id,
        ).catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
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
        updateTask(
          task.id,
          { title: task.title, description: task.description, status: nextStatus, priority: task.priority, assigned_to: task.assigned_to },
          currentUser.id,
        ).catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
          setError("Failed to update task status.");
        });
        return;
      }
      if (key.return && tasks.length > 0) {
        onViewTask(tasks[taskCursor]!.id);
        return;
      }
      if (input === "n" && onNewTask) {
        onNewTask();
        return;
      }
      if (input === "r") {
        void load();
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

  const isLead = currentUser.role === "lead";
  const roleColor = ROLE_COLORS[currentUser.role] ?? PRIMARY;
  const userColor = currentUser.chat_color ?? PRIMARY;
  const customRoles = currentUser.custom_roles ?? [];

  if (loading) return <Loader label="Loading your tasks..." />;

  return (
    <Box flexDirection="column" padding={1} width="100%">
      <Box marginBottom={1} justifyContent="space-between">
        <Box gap={2}>
          <Text bold color={FOCUS}>
            {isLead ? "Lead Dashboard" : "Dev Dashboard"}
          </Text>
          <Text color={roleColor}>[{currentUser.role}]</Text>
          {customRoles.map((r) => (
            <Text key={r.id} color={r.color}>
              [{r.name}]
            </Text>
          ))}
        </Box>
        <Text color={TEXT_MUTED}>
          Welcome,{" "}
          <Text bold color={userColor}>
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
      </Box>


      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        padding={1}
      >
        {tasks.length === 0 ? (
          <Text color={TEXT_DIM} dimColor>
            No tasks assigned to you yet.
            {onNewTask ? " Press [n] to create one." : ""}
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
                  {task.assignee_name &&
                    task.assignee_name !== currentUser.username && (
                      <Text color={TEXT_DIM} dimColor>
                        → {task.assignee_name}
                      </Text>
                    )}
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

      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <StatusBar
        bindings={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "view task" },
          { key: "←→", label: "status" },
          ...(onNewTask ? [{ key: "n", label: "new task" }] : []),
          { key: "r", label: "refresh" },
          { key: "m", label: "messages" },
          { key: "s", label: "settings" },
        ]}
      />
    </Box>
  );
}
