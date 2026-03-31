import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useEffect } from "react";
import { getTaskById, updateTask, getNextTaskStatus, getPreviousTaskStatus, canUserTransitionTaskStatus } from "../../lib/api.js";
import {
  getComments,
  addComment,
  toggleCommentLike,
} from "../../lib/api.js";
import { TagText } from "../ui/tag-text.js";
import { Loader } from "../ui/loader.js";
import { StatusBar } from "../ui/status-bar.js";
import {
  BORDER_SUBTLE,
  FOCUS,
  PRIMARY,
  TEXT_DIM,
  TEXT_MUTED,
  STATUS_COLORS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "../theme.js";
import type { User, Task, Comment } from "../../types/index.js";

interface TaskDetailProps {
  taskId: number;
  currentUser: User;
  onBack: () => void;
  onEdit?: () => void;
}

export function TaskDetail({
  taskId,
  currentUser,
  onBack,
  onEdit,
}: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [commentCursor, setCommentCursor] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    const [t, c] = await Promise.all([
      getTaskById(taskId),
      getComments(taskId, currentUser.id),
    ]);
    setTask(t);
    setComments(c);
    setCommentCursor((cursor) => Math.min(cursor, Math.max(0, c.length - 1)));
    setLoading(false);
  }

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [taskId, currentUser.id]);

  useInput(
    async (input, key) => {
      if (submitting) return;

      if (commenting) {
        if (key.escape) {
          setCommenting(false);
          setCommentText("");
          return;
        }
        if (key.return && commentText.trim()) {
          setSubmitting(true);
          setError("");
          try {
            await addComment(taskId, currentUser.id, commentText.trim());
            setCommentText("");
            setCommenting(false);
            await reload();
          } catch {
            setError("Failed to post comment.");
          }
          setSubmitting(false);
        }
        return;
      }

      if (key.escape || input === "b") {
        onBack();
        return;
      }
      if (key.upArrow) {
        setCommentCursor((cursor) => Math.max(0, cursor - 1));
        return;
      }
      if (key.downArrow) {
        setCommentCursor((cursor) => Math.min(comments.length - 1, cursor + 1));
        return;
      }
      if (key.leftArrow && task) {
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
        try {
          await updateTask(
            task.id,
            {
              title: task.title,
              description: task.description,
              status: previousStatus,
              priority: task.priority,
              assigned_to: task.assigned_to,
            },
            currentUser.id,
          );
          await reload();
        } catch {
          setError("Failed to update task status.");
        }
        return;
      }
      if (key.rightArrow && task) {
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
        try {
          await updateTask(
            task.id,
            {
              title: task.title,
              description: task.description,
              status: nextStatus,
              priority: task.priority,
              assigned_to: task.assigned_to,
            },
            currentUser.id,
          );
          await reload();
        } catch {
          setError("Failed to update task status.");
        }
        return;
      }
      if (input === "c") {
        setCommenting(true);
        return;
      }
      if (input === "l" && comments.length > 0) {
        const selectedComment = comments[commentCursor];
        if (!selectedComment) return;
        try {
          await toggleCommentLike(selectedComment.id, currentUser.id);
          await reload();
        } catch {
          setError("Failed to toggle like.");
        }
        return;
      }
      if (input === "e" && onEdit) {
        onEdit();
        return;
      }
    },
    { isActive: !loading },
  );

  if (loading) return <Loader label="Loading task..." />;
  if (!task) {
    return (
      <Box padding={1}>
        <Text color="red">Task not found.</Text>
      </Box>
    );
  }

  const bindings = [
    { key: "c", label: "comment" },
    { key: "↑↓", label: "comment select" },
    { key: "l", label: "like comment" },
    { key: "←→", label: "status" },
    { key: "b/Esc", label: "back" },
    ...(onEdit ? [{ key: "e", label: "edit" }] : []),
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={BORDER_SUBTLE}
        padding={1}
        marginBottom={1}
      >
        <Text bold color={FOCUS}>
          {task.title}
        </Text>

        <Box gap={2} marginTop={1}>
          <Text color={STATUS_COLORS[task.status] ?? PRIMARY} bold>
            {STATUS_LABELS[task.status]}
          </Text>
          <Text color={PRIORITY_COLORS[task.priority] ?? TEXT_MUTED}>
            [{PRIORITY_LABELS[task.priority]}]
          </Text>
          <Text color={TEXT_MUTED}>
            Assigned to:{" "}
            <Text color={task.assignee_name ? PRIMARY : TEXT_MUTED}>
              {task.assignee_name ?? "Nobody"}
            </Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color={TEXT_MUTED}>Created by {task.creator_name}</Text>
        </Box>

        {task.description ? (
          <Box marginTop={1} flexDirection="column">
            <Text color={TEXT_DIM} bold>
              Description
            </Text>
            <Text color={TEXT_MUTED}>{task.description}</Text>
          </Box>
        ) : null}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={FOCUS}>
          Comments ({comments.length})
        </Text>

        {comments.length === 0 && (
          <Text color={TEXT_DIM} dimColor>
            No comments yet.
          </Text>
        )}

        {comments.map((c, i) => (
          <Box key={c.id} flexDirection="column" marginTop={1}>
            <Box gap={1}>
              <Text
                color={i === commentCursor ? FOCUS : TEXT_MUTED}
                bold={i === commentCursor}
              >
                {i === commentCursor ? "▶" : " "}
              </Text>
              <Text bold color={PRIMARY}>
                {c.username}
              </Text>
              <Text color={TEXT_DIM} dimColor>
                {new Date(c.created_at).toLocaleString()}
              </Text>
            </Box>
            <Box marginLeft={1}>
              <TagText content={c.content} color={TEXT_MUTED} />
            </Box>
            <Box marginLeft={1}>
              <Text color={TEXT_DIM}>
                likes: {c.likes_count ?? 0}
                {c.is_liked_by_current_user ? " (you)" : ""}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {commenting && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={PRIMARY} bold>
            Add comment (use @username to tag)
          </Text>
          <Box>
            <Text color={TEXT_DIM}>› </Text>
            <TextInput
              value={commentText}
              onChange={setCommentText}
              focus={true}
              placeholder="Type your comment..."
            />
          </Box>
          <Text color={TEXT_DIM} dimColor>
            [Enter] post [Esc] cancel
          </Text>
        </Box>
      )}

      <StatusBar bindings={bindings} error={error} />
    </Box>
  );
}
