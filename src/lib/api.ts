import { loadSession } from "./session.js";
import type {
  User,
  Task,
  Comment,
  CustomRole,
  Role,
  TaskStatus,
  TaskPriority,
  LinqMessage,
  ChatMessage,
} from "../types/index.js";

const BASE_URL = process.env["DEVLINK_API_URL"] ?? "https://devlink-api.fly.dev";
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

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (authenticated) {
    const token = loadSession();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User } | null> {
  try {
    return await apiFetch<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }, false);
  } catch {
    return null;
  }
}

export async function getUsers(): Promise<User[]> {
  return apiFetch<User[]>("/users");
}

export async function getDevs(): Promise<User[]> {
  return apiFetch<User[]>("/users/devs");
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    return await apiFetch<User>(`/users/${id}`);
  } catch {
    return null;
  }
}

export async function updateUserPhone(userId: number, phone: string | null): Promise<User> {
  return apiFetch<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ phone }),
  });
}

export async function updateUserChatColor(userId: number, color: string | null): Promise<User> {
  return apiFetch<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ chat_color: color }),
  });
}

export async function updateUserRole(userId: number, role: Role): Promise<User> {
  return apiFetch<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function deleteUser(userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}`, { method: "DELETE" });
}

export async function createUser(
  username: string,
  email: string,
  password: string,
  role: Role,
  phone?: string
): Promise<User> {
  return apiFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify({ username, email, password, role, phone }),
  });
}

export async function getAllTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks");
}

export async function getTasksByAssignee(_userId: number): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks/mine");
}

export async function getTaskById(id: number): Promise<Task | null> {
  try {
    return await apiFetch<Task>(`/tasks/${id}`);
  } catch {
    return null;
  }
}

export async function createTask(data: {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: number;
  assigned_to: number | null;
}): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  id: number,
  data: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_to: number | null;
  },
  _actorUserId: number
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: number): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: "DELETE" });
}

export function canAssignTasks(user: User): boolean {
  if (user.role === "manager" || user.role === "lead") return true;
  return (user.custom_roles ?? []).some((r) => r.can_assign_tasks);
}

export async function getComments(taskId: number, _currentUserId?: number): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/tasks/${taskId}/comments`);
}

export async function addComment(taskId: number, _userId: number, content: string): Promise<Comment> {
  return apiFetch<Comment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function toggleCommentLike(commentId: number, _userId: number): Promise<boolean> {
  const result = await apiFetch<{ liked: boolean }>(`/comments/${commentId}/like`, { method: "POST" });
  return result.liked;
}

export async function getRoles(): Promise<CustomRole[]> {
  return apiFetch<CustomRole[]>("/roles");
}

export async function createRole(name: string, color: string, canAssignTasks: boolean): Promise<CustomRole> {
  return apiFetch<CustomRole>("/roles", {
    method: "POST",
    body: JSON.stringify({ name, color, can_assign_tasks: canAssignTasks }),
  });
}

export async function updateRole(
  id: number,
  patch: { name?: string; color?: string; can_assign_tasks?: boolean }
): Promise<void> {
  return apiFetch<void>(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteRole(id: number): Promise<void> {
  return apiFetch<void>(`/roles/${id}`, { method: "DELETE" });
}

export async function getUserRoles(userId: number): Promise<CustomRole[]> {
  return apiFetch<CustomRole[]>(`/users/${userId}/roles`);
}

export async function assignRole(userId: number, roleId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}/roles/${roleId}`, { method: "POST" });
}

export async function removeRole(userId: number, roleId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}/roles/${roleId}`, { method: "DELETE" });
}

export async function getTeamChatMessages(): Promise<{ chatId: string; messages: LinqMessage[] }> {
  return apiFetch<{ chatId: string; messages: LinqMessage[] }>("/linq/team-chat/messages");
}

export async function sendTeamMessage(text: string): Promise<void> {
  return apiFetch<void>("/linq/team-chat/messages", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function clearTeamChat(): Promise<void> {
  return apiFetch<void>("/linq/team-chat/clear", { method: "POST" });
}

export async function deleteLinqMessage(messageId: string): Promise<void> {
  return apiFetch<void>(`/linq/messages/${messageId}`, { method: "DELETE" });
}

export async function askAI(
  history: ChatMessage[],
  _user: User,
  _tasks: Task[],
  _comments: Comment[],
  _teamMembers: User[] = []
): Promise<string> {
  const result = await apiFetch<{ reply: string }>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ history }),
  });
  return result.reply;
}

export async function getAISummary(
  _user: User,
  _tasks: Task[],
  _comments: Comment[],
  _teamMembers: User[] = []
): Promise<string> {
  const result = await apiFetch<{ summary: string }>("/ai/summary", { method: "POST" });
  return result.summary;
}

export { parseSender, formatOutgoing, isTeamChatBootstrapMessage } from "./linq-utils.js";
