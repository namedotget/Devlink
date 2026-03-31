import type { Task, TaskStatus, User } from "../types.js";

export const TASK_STATUS_FLOW: TaskStatus[] = ["todo", "wip", "review", "done"];

export function getNextTaskStatus(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_FLOW.indexOf(status);
  if (index < 0 || index >= TASK_STATUS_FLOW.length - 1) return null;
  return TASK_STATUS_FLOW[index + 1] ?? null;
}

export function getPreviousTaskStatus(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_FLOW.indexOf(status);
  if (index <= 0) return null;
  return TASK_STATUS_FLOW[index - 1] ?? null;
}

export function canUserTransitionTaskStatus(input: {
  user: User;
  task: Task;
  targetStatus: TaskStatus;
}): { allowed: boolean; reason?: string } {
  const { user, task, targetStatus } = input;
  const isManagerOrLead = user.role === "manager" || user.role === "lead";
  const isAssigner = user.id === task.created_by;
  const isAssignee = task.assigned_to !== null && user.id === task.assigned_to;
  const canMoveTask = isManagerOrLead || isAssigner || isAssignee;

  if (!canMoveTask) {
    return {
      allowed: false,
      reason: "Only assigner or assignee can change task status.",
    };
  }

  if (targetStatus === "done" && !isManagerOrLead) {
    return {
      allowed: false,
      reason: "Only managers and leads can mark tasks done.",
    };
  }

  if (targetStatus === "done" && task.status !== "review") {
    return {
      allowed: false,
      reason: "Task must be in review before done.",
    };
  }

  return { allowed: true };
}
