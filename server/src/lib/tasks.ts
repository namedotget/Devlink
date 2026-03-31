import { sql } from "./db.js";
import type { Task, TaskStatus, TaskPriority, User } from "../types.js";
import { canUserTransitionTaskStatus } from "./task-status.js";
import { getUserById } from "./users.js";

export function canAssignTasks(user: User): boolean {
  return user.role === "manager" || user.role === "lead";
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row["id"] as number,
    title: row["title"] as string,
    description: row["description"] as string,
    status: row["status"] as TaskStatus,
    priority: row["priority"] as TaskPriority,
    created_by: row["created_by"] as number,
    assigned_to: row["assigned_to"] as number | null,
    creator_name: row["creator_name"] as string,
    assignee_name: row["assignee_name"] as string | null,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const rows = await sql`
    SELECT
      t.id, t.title, t.description, t.status, t.priority,
      t.created_by, t.assigned_to, t.created_at, t.updated_at,
      c.username AS creator_name,
      a.username AS assignee_name
    FROM tasks t
    JOIN users c ON c.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    ORDER BY t.updated_at DESC
  `;
  return rows.map(rowToTask);
}

export async function getTasksByAssignee(userId: number): Promise<Task[]> {
  const rows = await sql`
    SELECT
      t.id, t.title, t.description, t.status, t.priority,
      t.created_by, t.assigned_to, t.created_at, t.updated_at,
      c.username AS creator_name,
      a.username AS assignee_name
    FROM tasks t
    JOIN users c ON c.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE t.assigned_to = ${userId}
    ORDER BY t.updated_at DESC
  `;
  return rows.map(rowToTask);
}

export async function getTaskById(id: number): Promise<Task | null> {
  const rows = await sql`
    SELECT
      t.id, t.title, t.description, t.status, t.priority,
      t.created_by, t.assigned_to, t.created_at, t.updated_at,
      c.username AS creator_name,
      a.username AS assignee_name
    FROM tasks t
    JOIN users c ON c.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE t.id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToTask(rows[0]);
}

export async function createTask(data: {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: number;
  assigned_to: number | null;
}): Promise<Task> {
  const rows = await sql`
    INSERT INTO tasks (title, description, status, priority, created_by, assigned_to)
    VALUES (${data.title}, ${data.description}, ${data.status}, ${data.priority}, ${data.created_by}, ${data.assigned_to})
    RETURNING id
  `;
  const id = rows[0]["id"] as number;
  return (await getTaskById(id))!;
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
  actorUserId: number,
): Promise<Task> {
  const previousTask = await getTaskById(id);
  if (!previousTask) {
    throw new Error("Task not found.");
  }
  if (previousTask.status !== data.status) {
    const actor = await getUserById(actorUserId);
    if (!actor) {
      throw new Error("Actor not found.");
    }
    const transition = canUserTransitionTaskStatus({
      user: actor,
      task: previousTask,
      targetStatus: data.status,
    });
    if (!transition.allowed) {
      throw new Error(transition.reason ?? "Status transition is not allowed.");
    }
  }

  await sql`
    UPDATE tasks SET
      title = ${data.title},
      description = ${data.description},
      status = ${data.status},
      priority = ${data.priority},
      assigned_to = ${data.assigned_to},
      updated_at = NOW()
    WHERE id = ${id}
  `;
  return (await getTaskById(id))!;
}

export async function deleteTask(id: number): Promise<void> {
  await sql`DELETE FROM tasks WHERE id = ${id}`;
}
